/**
 * Enterprise Incident Management Engine
 *
 * Main orchestrator composing all 8 sub-services:
 *   IncidentDetector, SeverityClassifier, SLAEngine, EscalationManager,
 *   ClientNotificationService, StatusPageService, PostmortemManager, AvailabilityReporter
 *
 * Integrations:
 *   - ObservabilityCore → auto-detection from health/error/latency signals
 *   - SelfHealingEngine → failed recovery triggers incident
 *   - Control Plane → dashboard stats and management UI
 *   - GovernanceAI → postmortem analysis suggestions
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import { INCIDENT_KERNEL_EVENTS } from './incident-events';
import type {
  IncidentCreatedPayload,
  IncidentEscalatedPayload,
  SLABreachedPayload,
  PostmortemPublishedPayload,
} from './incident-events';
import { createGlobalEventKernel } from '@/domains/platform-os/global-event-kernel';

// Lazy singleton for kernel emission
let _kernel: ReturnType<typeof createGlobalEventKernel> | null = null;
function getKernel() {
  if (!_kernel) _kernel = createGlobalEventKernel();
  return _kernel;
}

const INCIDENT_ADMIN_ROLES: PlatformRoleType[] = ['platform_super_admin', 'platform_operations'];

/**
 * Verify caller has PlatformOperations or PlatformSuperAdmin role.
 * Throws if unauthorized.
 */
async function assertIncidentAdmin(userId?: string): Promise<void> {
  if (!userId) throw new Error('Unauthorized: user ID required to modify incident status.');

  const { data } = await supabase
    .from('platform_users')
    .select('role_id, platform_roles(slug)')
    .eq('user_id', userId)
    .single();

  const roleSlug = (data as any)?.platform_roles?.slug as string | undefined;
  if (!roleSlug || !INCIDENT_ADMIN_ROLES.includes(roleSlug as PlatformRoleType)) {
    throw new Error(`Unauthorized: role "${roleSlug ?? 'unknown'}" cannot modify incident status. Required: ${INCIDENT_ADMIN_ROLES.join(', ')}`);
  }
}
import type {
  IncidentManagementEngineAPI,
  IncidentDetectorAPI,
  SeverityClassifierAPI,
  SLAEngineAPI,
  EscalationManagerAPI,
  ClientNotificationServiceAPI,
  StatusPageServiceAPI,
  PostmortemManagerAPI,
  AvailabilityReporterAPI,
  Incident,
  IncidentUpdate,
  SLAConfig,
  EscalationRecord,
  StatusPageComponent,
  StatusPageIncident,
  Postmortem,
  AvailabilityRecord,
  CreateIncidentInput,
  DetectionSignal,
  IncidentSeverity,
  IncidentStatus,
  EscalationLevel,
  ComponentStatus,
  IncidentDashboardStats,
  RemediationSuggestion,
} from './types';

// ══════════════════════════════════
// SEVERITY CLASSIFIER
// ══════════════════════════════════

/**
 * Severity classification rules:
 *   Sev1 → module offline OR global impact
 *   Sev2 → critical module degraded
 *   Sev3 → partial failure
 *   Sev4 → minor error
 */
function createSeverityClassifier(): SeverityClassifierAPI {
  const SIGNAL_TO_SEVERITY: Record<string, IncidentSeverity> = {
    self_healing_failed: 'sev1',   // module offline
    health_degraded: 'sev2',       // critical module degraded
    error_spike: 'sev3',           // partial failure
    latency_exceeded: 'sev3',      // partial failure
    manual: 'sev4',                // minor / manual triage
  };

  return {
    classify(signal) {
      if (signal.severity_hint) return signal.severity_hint;
      return SIGNAL_TO_SEVERITY[signal.type] ?? 'sev4';
    },

    reclassify(incident, newEvidence) {
      // Sev1: module offline or global impact
      if (newEvidence.module_offline === true || newEvidence.user_impact === 'total') return 'sev1';
      // Sev2: critical module degraded
      if (newEvidence.user_impact === 'major' || newEvidence.critical_degraded === true) return 'sev2';
      // Sev3: partial failure (multiple modules affected)
      const affectedCount = incident.affected_modules.length + incident.affected_services.length;
      if (affectedCount >= 2 || newEvidence.user_impact === 'partial') return 'sev3';
      // Keep current or default sev4
      return incident.severity;
    },
  };
}

// ══════════════════════════════════
// INCIDENT DETECTOR
// ══════════════════════════════════

function createIncidentDetector(classifier: SeverityClassifierAPI): IncidentDetectorAPI {
  const DEDUP_WINDOW_MS = 15 * 60_000; // 15 min

  return {
    async processSignal(signal) {
      // Check for existing correlated incident first
      const existing = await this.correlateWithExisting(signal);
      if (existing) {
        // Update existing incident with new evidence
        await supabase.from('incident_updates' as any).insert({
          incident_id: existing.id,
          update_type: 'auto_correlated',
          message: `Signal correlated: ${signal.title} (${signal.type})`,
          metadata: signal.metadata ?? {},
        } as any);
        return existing;
      }

      const severity = classifier.classify(signal);

      const { data, error } = await (supabase.from('incidents' as any).insert({
        title: signal.title,
        description: signal.description,
        severity,
        source: signal.type,
        source_ref: signal.source_module,
        affected_modules: [signal.source_module],
        metadata: signal.metadata ?? {},
      } as any).select().single() as any);

      if (error) {
        console.error('[IncidentDetector] Create failed:', error.message);
        return null;
      }
      return data as Incident;
    },

    async correlateWithExisting(signal) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
      const { data } = await (supabase.from('incidents' as any)
        .select('*')
        .in('status', ['open', 'investigating', 'mitigated'])
        .contains('affected_modules', [signal.source_module])
        .gte('created_at', since)
        .limit(1)
        .single() as any);

      return (data as Incident) ?? null;
    },
  };
}

// ══════════════════════════════════
// SLA ENGINE
// ══════════════════════════════════

/**
 * SLA targets by severity (defaults):
 *   Sev1 → response 5min,  resolution 1h
 *   Sev2 → response 15min, resolution 4h
 *   Sev3 → response 30min, resolution 8h
 *   Sev4 → response 60min, resolution 24h
 */
const SLA_DEFAULTS: Record<IncidentSeverity, { response: number; resolution: number }> = {
  sev1: { response: 5, resolution: 60 },
  sev2: { response: 15, resolution: 240 },
  sev3: { response: 30, resolution: 480 },
  sev4: { response: 60, resolution: 1440 },
};

function createSLAEngine(notifyBreach: (incident: Incident, type: 'response' | 'resolution') => Promise<void>): SLAEngineAPI {
  return {
    async getConfig(severity, tenantId) {
      // Try tenant-specific first, then global
      if (tenantId) {
        const { data: tenantConfig } = await (supabase.from('incident_sla_configs' as any)
          .select('*').eq('severity', severity).eq('is_active', true)
          .eq('tenant_id', tenantId).single() as any);
        if (tenantConfig) return tenantConfig as SLAConfig;
      }

      const { data: globalConfig } = await (supabase.from('incident_sla_configs' as any)
        .select('*').eq('severity', severity).eq('is_active', true)
        .is('tenant_id', null).single() as any);

      const defaults = SLA_DEFAULTS[severity] ?? SLA_DEFAULTS.sev3;
      return (globalConfig as SLAConfig) ?? {
        response_time_minutes: defaults.response,
        acknowledgement_time_minutes: defaults.response,
        resolution_time_minutes: defaults.resolution,
        escalation_after_minutes: Math.round(defaults.resolution / 4),
        notification_interval_minutes: 30,
      };
    },

    async applyDeadlines(incident) {
      const config = await this.getConfig(incident.severity, incident.tenant_id);
      const now = new Date();

      const deadlines = {
        sla_response_deadline: new Date(now.getTime() + config.response_time_minutes * 60_000).toISOString(),
        sla_ack_deadline: new Date(now.getTime() + config.acknowledgement_time_minutes * 60_000).toISOString(),
        sla_resolution_deadline: new Date(now.getTime() + config.resolution_time_minutes * 60_000).toISOString(),
      };

      await (supabase.from('incidents' as any).update(deadlines as any).eq('id', incident.id) as any);
      return { ...incident, ...deadlines };
    },

    async checkBreaches() {
      const now = new Date();
      const nowISO = now.toISOString();

      const { data } = await (supabase.from('incidents' as any)
        .select('*').eq('sla_breached', false)
        .in('status', ['open', 'investigating', 'mitigated'])
        .or(`sla_response_deadline.lt.${nowISO},sla_resolution_deadline.lt.${nowISO}`) as any);

      const breached = (data ?? []) as Incident[];

      for (const incident of breached) {
        // Determine which target was breached
        const responseDeadline = incident.sla_response_deadline ? new Date(incident.sla_response_deadline) : null;
        const resolutionDeadline = incident.sla_resolution_deadline ? new Date(incident.sla_resolution_deadline) : null;

        const breachType: 'response' | 'resolution' =
          (responseDeadline && now > responseDeadline && incident.status === 'open')
            ? 'response'
            : 'resolution';

        // Mark breached
        await (supabase.from('incidents' as any).update({ sla_breached: true } as any).eq('id', incident.id) as any);

        // Log breach update
        const elapsed = Math.round((now.getTime() - new Date(incident.created_at).getTime()) / 60_000);
        await (supabase.from('incident_updates' as any).insert({
          incident_id: incident.id,
          update_type: 'sla_breach',
          message: `⚠️ SLA ${breachType === 'response' ? 'response_time_target' : 'resolution_time_target'} breached after ${elapsed} minutes`,
          is_public: false,
          metadata: { breach_type: breachType, elapsed_minutes: elapsed },
        } as any) as any);

        // Fire alert notification
        await notifyBreach(incident, breachType);

        // Emit kernel event: SLABreached
        getKernel().emit<SLABreachedPayload>(
          INCIDENT_KERNEL_EVENTS.SLABreached,
          'SLAEngine',
          {
            incident_id: incident.id,
            severity: incident.severity,
            tenant_id: incident.tenant_id ?? null,
            deadline_type: breachType === 'response' ? 'response' : 'resolution',
            elapsed_minutes: elapsed,
          },
          { priority: 'critical' },
        );
      }

      return breached;
    },
  };
}

// ══════════════════════════════════
// ESCALATION MANAGER
// ══════════════════════════════════

const ESCALATION_ORDER: EscalationLevel[] = ['l1', 'l2', 'l3', 'management', 'executive'];

function createEscalationManager(slaEngine: SLAEngineAPI): EscalationManagerAPI {
  return {
    /**
     * Escalation rules:
     *   - SLA response_time_target breached → escalate to L2 (N2)
     *   - SLA resolution_time_target breached → escalate to management (Diretor Técnico)
     */
    async evaluate(incident) {
      if (incident.status === 'resolved') return null;

      const now = Date.now();
      const responseDeadline = incident.sla_response_deadline ? new Date(incident.sla_response_deadline).getTime() : null;
      const resolutionDeadline = incident.sla_resolution_deadline ? new Date(incident.sla_resolution_deadline).getTime() : null;

      // Rule 1: response target breached → escalate to L2
      if (responseDeadline && now > responseDeadline && incident.escalation_level === 'l1') {
        return 'l2';
      }

      // Rule 2: resolution target breached → escalate to management (Diretor Técnico)
      if (resolutionDeadline && now > resolutionDeadline) {
        const currentIdx = ESCALATION_ORDER.indexOf(incident.escalation_level);
        const mgmtIdx = ESCALATION_ORDER.indexOf('management');
        if (currentIdx < mgmtIdx) return 'management';
      }

      return null;
    },

    async escalate(incidentId, toLevel, reason, autoEscalated = false) {
      const { data: incident } = await (supabase.from('incidents' as any)
        .select('escalation_level').eq('id', incidentId).single() as any);

      if (!incident) return;

      await (supabase.from('incident_escalations' as any).insert({
        incident_id: incidentId,
        from_level: incident.escalation_level,
        to_level: toLevel,
        reason,
        auto_escalated: autoEscalated,
      } as any) as any);

      await (supabase.from('incidents' as any).update({ escalation_level: toLevel } as any).eq('id', incidentId) as any);

      await (supabase.from('incident_updates' as any).insert({
        incident_id: incidentId,
        update_type: 'escalation',
        message: `Escalated from ${incident.escalation_level} to ${toLevel}: ${reason}`,
        metadata: { auto_escalated: autoEscalated },
      } as any) as any);

      // Emit kernel event: IncidentEscalated
      getKernel().emit<IncidentEscalatedPayload>(
        INCIDENT_KERNEL_EVENTS.IncidentEscalated,
        'EscalationManager',
        {
          incident_id: incidentId,
          from_level: incident.escalation_level,
          to_level: toLevel,
          reason,
          auto_escalated: autoEscalated,
        },
        { priority: 'high' },
      );
    },

    async getHistory(incidentId) {
      const { data } = await (supabase.from('incident_escalations' as any)
        .select('*').eq('incident_id', incidentId)
        .order('created_at', { ascending: true }) as any);
      return (data ?? []) as EscalationRecord[];
    },
  };
}

// ══════════════════════════════════
// CLIENT NOTIFICATION SERVICE
// ══════════════════════════════════

/**
 * Multi-channel notification:
 *   - in_app  → painel interno (always)
 *   - email   → queued for sending
 *   - webhook → queued for delivery
 *
 * Scope:
 *   - If incident has affected_tenants → notify each tenant
 *   - If affected_tenants is empty (global) → notify ALL tenants
 */
const CHANNELS: Array<'in_app' | 'email' | 'webhook'> = ['in_app', 'email', 'webhook'];

function createClientNotificationService(): ClientNotificationServiceAPI {

  async function resolveRecipientTenants(incident: Incident): Promise<Array<{ id: string; name: string }>> {
    const affectedTenants = incident.affected_tenants ?? [];

    if (affectedTenants.length > 0) {
      // Notify only affected tenants
      const { data } = await (supabase.from('tenants' as any)
        .select('id, name').in('id', affectedTenants) as any);
      return (data ?? []) as Array<{ id: string; name: string }>;
    }

    // Global incident → notify all active tenants
    const { data } = await (supabase.from('tenants' as any)
      .select('id, name').eq('status', 'active') as any);
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  async function fanOutNotification(
    incidentId: string,
    tenants: Array<{ id: string; name: string }>,
    subject: string,
    body: string,
  ) {
    const rows = tenants.flatMap(t =>
      CHANNELS.map(channel => ({
        incident_id: incidentId,
        tenant_id: t.id,
        channel,
        recipient: channel === 'email' ? `admin@${t.name}` : t.id,
        subject,
        body,
        status: 'pending',
      }))
    );

    // Also add a platform-level in_app notification
    rows.push({
      incident_id: incidentId,
      tenant_id: null as any,
      channel: 'in_app',
      recipient: 'platform',
      subject,
      body,
      status: 'pending',
    });

    if (rows.length > 0) {
      await (supabase.from('incident_notifications' as any).insert(rows as any) as any);
    }
  }

  return {
    async notifyIncidentCreated(incident) {
      const tenants = await resolveRecipientTenants(incident);
      const scope = tenants.length > 0 && (incident.affected_tenants?.length ?? 0) > 0
        ? `Tenants afetados: ${tenants.map(t => t.name).join(', ')}`
        : 'Impacto global — todos os tenants notificados';

      await fanOutNotification(
        incident.id, tenants,
        `[${incident.severity.toUpperCase()}] Incidente: ${incident.title}`,
        `Novo incidente ${incident.severity} detectado: ${incident.title}. ${scope}. Equipe investigando.`,
      );
    },

    async notifyStatusUpdate(incident, update) {
      const tenants = await resolveRecipientTenants(incident);
      await fanOutNotification(
        incident.id, tenants,
        `Atualização: ${incident.title}`,
        `Status alterado para ${update.new_status}: ${update.message}`,
      );
    },

    async notifyResolution(incident) {
      const tenants = await resolveRecipientTenants(incident);
      await fanOutNotification(
        incident.id, tenants,
        `Resolvido: ${incident.title}`,
        `O incidente "${incident.title}" foi resolvido. ${incident.resolution_summary ?? ''}`,
      );
    },

    async notifySLABreach(incident) {
      const tenants = await resolveRecipientTenants(incident);
      await fanOutNotification(
        incident.id, tenants,
        `⚠️ SLA Violado: ${incident.title}`,
        `SLA violado para o incidente "${incident.title}" (severidade: ${incident.severity}).`,
      );
    },
  };
}

// ══════════════════════════════════
// STATUS PAGE SERVICE
// ══════════════════════════════════

function createStatusPageService(): StatusPageServiceAPI {
  return {
    async publishIncident(incident) {
      const { data, error } = await (supabase.from('status_page_incidents' as any).insert({
        incident_id: incident.id,
        tenant_id: incident.tenant_id,
        title: incident.title,
        impact: incident.severity === 'sev1' ? 'major_outage' : incident.severity === 'sev2' ? 'partial_outage' : 'degraded_performance',
        status: 'investigating',
        affected_components: [],
      } as any).select().single() as any);

      if (error) console.error('[StatusPage] publish failed:', error.message);
      return data as StatusPageIncident;
    },

    async updateIncidentStatus(incidentId, status, _message) {
      await (supabase.from('status_page_incidents' as any)
        .update({ status } as any)
        .eq('incident_id', incidentId) as any);
    },

    async getComponents(tenantId) {
      let q = supabase.from('status_page_components' as any).select('*').eq('is_active', true).order('display_order');
      if (tenantId) q = q.eq('tenant_id', tenantId) as any;
      const { data } = await (q as any);
      return (data ?? []) as StatusPageComponent[];
    },

    async updateComponentStatus(componentId, status) {
      await (supabase.from('status_page_components' as any)
        .update({ current_status: status } as any)
        .eq('id', componentId) as any);
    },

    async getPublicIncidents(tenantId) {
      let q = supabase.from('status_page_incidents' as any).select('*').order('created_at', { ascending: false }).limit(20);
      if (tenantId) q = q.eq('tenant_id', tenantId) as any;
      const { data } = await (q as any);
      return (data ?? []) as StatusPageIncident[];
    },
  };
}

// ══════════════════════════════════
// POSTMORTEM MANAGER
// ══════════════════════════════════

function createPostmortemManager(): PostmortemManagerAPI {
  /**
   * Compute impact duration from incident timestamps (created → resolved).
   */
  async function computeImpactDuration(incidentId: string): Promise<number | null> {
    const { data } = await (supabase.from('incidents' as any)
      .select('created_at, resolved_at')
      .eq('id', incidentId)
      .single() as any);
    if (!data?.created_at || !data?.resolved_at) return null;
    const start = new Date(data.created_at).getTime();
    const end = new Date(data.resolved_at).getTime();
    return Math.round((end - start) / 60_000);
  }

  return {
    async create(incidentId, summary, createdBy) {
      // Auto-compute impact duration from incident
      const impactMinutes = await computeImpactDuration(incidentId);

      const { data, error } = await (supabase.from('incident_postmortems' as any).insert({
        incident_id: incidentId,
        summary,
        created_by: createdBy ?? null,
        status: 'draft',
        impact_duration_minutes: impactMinutes,
        root_cause_analysis: null,
        contributing_factors: [],
        action_items: [],
        lessons_learned: null,
        timeline_events: [],
      } as any).select().single() as any);

      if (error) throw new Error(`Postmortem creation failed: ${error.message}`);
      return data as Postmortem;
    },

    async update(postmortemId, patch) {
      const updateData: Record<string, unknown> = {};
      if (patch.summary !== undefined) updateData.summary = patch.summary;
      if (patch.root_cause_analysis !== undefined) updateData.root_cause_analysis = patch.root_cause_analysis;
      if (patch.contributing_factors !== undefined) updateData.contributing_factors = patch.contributing_factors;
      if (patch.action_items !== undefined) updateData.action_items = patch.action_items;
      if (patch.lessons_learned !== undefined) updateData.lessons_learned = patch.lessons_learned;
      if (patch.impact_duration_minutes !== undefined) updateData.impact_duration_minutes = patch.impact_duration_minutes;
      if (patch.affected_users_count !== undefined) updateData.affected_users_count = patch.affected_users_count;
      if (patch.revenue_impact_estimate !== undefined) updateData.revenue_impact_estimate = patch.revenue_impact_estimate;
      if (patch.timeline_events !== undefined) updateData.timeline_events = patch.timeline_events;

      await (supabase.from('incident_postmortems' as any).update(updateData as any).eq('id', postmortemId) as any);
    },

    async publish(postmortemId, reviewedBy) {
      // On publish, emit kernel event for cross-domain integration
      const { data: pm } = await (supabase.from('incident_postmortems' as any)
        .select('*').eq('id', postmortemId).single() as any);

      await (supabase.from('incident_postmortems' as any).update({
        status: 'published',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      } as any).eq('id', postmortemId) as any);

      if (pm) {
        console.info('[PostmortemManager] Published postmortem for incident', pm.incident_id, {
          impact_duration_minutes: pm.impact_duration_minutes,
          action_items_count: (pm.action_items as any[])?.length ?? 0,
          root_cause: pm.root_cause_analysis ? 'provided' : 'missing',
        });

        // Emit kernel event: PostmortemPublished
        getKernel().emit<PostmortemPublishedPayload>(
          INCIDENT_KERNEL_EVENTS.PostmortemPublished,
          'PostmortemManager',
          {
            postmortem_id: postmortemId,
            incident_id: pm.incident_id,
            impact_duration_minutes: pm.impact_duration_minutes ?? null,
            action_items_count: (pm.action_items as any[])?.length ?? 0,
          },
          { priority: 'normal' },
        );
      }
    },

    async getByIncident(incidentId) {
      const { data } = await (supabase.from('incident_postmortems' as any)
        .select('*').eq('incident_id', incidentId).maybeSingle() as any);
      return (data as Postmortem) ?? null;
    },
  };
}

// ══════════════════════════════════
// AVAILABILITY REPORTER
// ══════════════════════════════════

function createAvailabilityReporter(): AvailabilityReporterAPI {
  return {
    async recordDowntime(tenantId, componentId, downtimeMinutes, incidentCount) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const totalMinutes = 1440;
      const uptimePct = Math.max(0, ((totalMinutes - downtimeMinutes) / totalMinutes) * 100);

      await (supabase.from('availability_records' as any).upsert({
        tenant_id: tenantId,
        component_id: componentId,
        period_start: periodStart,
        period_end: periodEnd,
        period_type: 'daily',
        total_minutes: totalMinutes,
        downtime_minutes: downtimeMinutes,
        uptime_percentage: Math.round(uptimePct * 1000) / 1000,
        incident_count: incidentCount,
        sla_met: uptimePct >= 99.9,
      } as any, { onConflict: 'id' }) as any);
    },

    async getReport(tenantId, days = 30) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      let q = supabase.from('availability_records' as any)
        .select('*')
        .gte('period_start', since)
        .order('period_start', { ascending: false });

      if (tenantId) q = q.eq('tenant_id', tenantId) as any;
      const { data } = await (q as any);
      return (data ?? []) as AvailabilityRecord[];
    },

    async getCurrentUptime(tenantId) {
      const records30 = await this.getReport(tenantId ?? null, 30);
      const records90 = await this.getReport(tenantId ?? null, 90);

      const calcAvg = (recs: AvailabilityRecord[]) => {
        if (recs.length === 0) return 100;
        return Math.round((recs.reduce((s, r) => s + r.uptime_percentage, 0) / recs.length) * 1000) / 1000;
      };

      return { uptime_30d: calcAvg(records30), uptime_90d: calcAvg(records90) };
    },
  };
}

// ══════════════════════════════════
// MAIN ENGINE
// ══════════════════════════════════

export function createIncidentManagementEngine(): IncidentManagementEngineAPI {
  const classifier = createSeverityClassifier();
  const detector = createIncidentDetector(classifier);
  const notifications = createClientNotificationService();
  const sla = createSLAEngine(async (incident, breachType) => {
    await notifications.notifySLABreach(incident);
    console.warn(`[SLA] ${breachType}_target breached for incident ${incident.id} [${incident.severity}]`);
  });
  const escalation = createEscalationManager(sla);
  const statusPage = createStatusPageService();
  const postmortem = createPostmortemManager();
  const availability = createAvailabilityReporter();

  return {
    detector,
    classifier,
    sla,
    escalation,
    notifications,
    statusPage,
    postmortem,
    availability,

    async createIncident(input) {
      const { data, error } = await (supabase.from('incidents' as any).insert({
        tenant_id: input.tenant_id ?? null,
        title: input.title,
        description: input.description ?? null,
        severity: input.severity,
        source: input.source ?? 'manual',
        source_ref: input.source_ref ?? null,
        affected_modules: input.affected_modules ?? [],
        affected_services: input.affected_services ?? [],
        impact_description: input.impact_description ?? null,
        is_public: input.is_public ?? false,
        metadata: input.metadata ?? {},
      } as any).select().single() as any);

      if (error) throw new Error(`Create incident failed: ${error.message}`);
      const incident = data as Incident;

      // Apply SLA deadlines
      const withSLA = await sla.applyDeadlines(incident);

      // Add creation update
      await (supabase.from('incident_updates' as any).insert({
        incident_id: incident.id,
        update_type: 'created',
        new_status: 'open',
        message: `Incident created: ${incident.title} [${incident.severity}]`,
        is_public: incident.is_public,
      } as any) as any);

      // Notify
      await notifications.notifyIncidentCreated(withSLA);

      // Publish to status page if public
      if (incident.is_public) {
        await statusPage.publishIncident(withSLA);
      }

      // Emit kernel event: IncidentCreated
      getKernel().emit<IncidentCreatedPayload>(
        INCIDENT_KERNEL_EVENTS.IncidentCreated,
        'IncidentManagementEngine',
        {
          incident_id: incident.id,
          title: incident.title,
          severity: incident.severity,
          source: incident.source ?? 'manual',
          tenant_id: incident.tenant_id ?? null,
          affected_modules: incident.affected_modules ?? [],
        },
        { priority: incident.severity === 'sev1' ? 'critical' : 'high' },
      );

      return withSLA;
    },

    async acknowledgeIncident(incidentId, userId) {
      await assertIncidentAdmin(userId);
      await (supabase.from('incidents' as any).update({
        status: 'investigating',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      } as any).eq('id', incidentId) as any);

      await (supabase.from('incident_updates' as any).insert({
        incident_id: incidentId,
        author_id: userId,
        update_type: 'status_change',
        previous_status: 'open',
        new_status: 'investigating',
        message: 'Incident acknowledged and under investigation.',
        is_public: true,
      } as any) as any);
    },

    async updateIncidentStatus(incidentId, status, message, userId) {
      await assertIncidentAdmin(userId);
      const { data: current } = await (supabase.from('incidents' as any)
        .select('status, is_public, tenant_id, title')
        .eq('id', incidentId).single() as any);

      await (supabase.from('incidents' as any).update({ status } as any).eq('id', incidentId) as any);

      const update = {
        incident_id: incidentId,
        author_id: userId ?? null,
        update_type: 'status_change',
        previous_status: current?.status,
        new_status: status,
        message,
        is_public: current?.is_public ?? false,
      };

      await (supabase.from('incident_updates' as any).insert(update as any) as any);

      // Notify
      if (current?.is_public) {
        await statusPage.updateIncidentStatus(incidentId, status, message);
      }

      await notifications.notifyStatusUpdate(
        { ...current, id: incidentId } as Incident,
        update as unknown as IncidentUpdate,
      );
    },

    async resolveIncident(incidentId, resolution, userId) {
      await assertIncidentAdmin(userId);
      await (supabase.from('incidents' as any).update({
        status: 'resolved',
        resolution_summary: resolution,
        resolved_by: userId ?? null,
        resolved_at: new Date().toISOString(),
      } as any).eq('id', incidentId) as any);

      await (supabase.from('incident_updates' as any).insert({
        incident_id: incidentId,
        author_id: userId ?? null,
        update_type: 'status_change',
        new_status: 'resolved',
        message: `Resolved: ${resolution}`,
        is_public: true,
      } as any) as any);

      const incident = await this.getIncident(incidentId);
      if (incident) {
        await notifications.notifyResolution(incident);
        if (incident.is_public) {
          await statusPage.updateIncidentStatus(incidentId, 'resolved', resolution);
        }

        // Emit kernel event: IncidentResolved
        getKernel().emit(
          INCIDENT_KERNEL_EVENTS.IncidentResolved,
          'IncidentManagementEngine',
          {
            incident_id: incidentId,
            severity: incident.severity,
            tenant_id: incident.tenant_id ?? null,
            resolution_summary: resolution,
          },
          { priority: 'normal' },
        );
      }
    },

    async closeIncident(incidentId, userId) {
      await assertIncidentAdmin(userId);
      await (supabase.from('incidents' as any).update({
        status: 'closed',
        closed_by: userId ?? null,
        closed_at: new Date().toISOString(),
      } as any).eq('id', incidentId) as any);

      await (supabase.from('incident_updates' as any).insert({
        incident_id: incidentId,
        author_id: userId ?? null,
        update_type: 'status_change',
        new_status: 'closed',
        message: 'Incident closed.',
        is_public: true,
      } as any) as any);
    },

    async getIncident(incidentId) {
      const { data } = await (supabase.from('incidents' as any)
        .select('*').eq('id', incidentId).maybeSingle() as any);
      return (data as Incident) ?? null;
    },

    async listIncidents(filters) {
      let q = supabase.from('incidents' as any).select('*').order('created_at', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status) as any;
      if (filters?.severity) q = q.eq('severity', filters.severity) as any;
      if (filters?.tenant_id) q = q.eq('tenant_id', filters.tenant_id) as any;
      q = q.limit(filters?.limit ?? 100) as any;
      const { data } = await (q as any);
      return (data ?? []) as Incident[];
    },

    async getTimeline(incidentId) {
      const { data } = await (supabase.from('incident_updates' as any)
        .select('*').eq('incident_id', incidentId)
        .order('created_at', { ascending: true }) as any);
      return (data ?? []) as IncidentUpdate[];
    },

    async getDashboardStats() {
      const { data: open } = await (supabase.from('incidents' as any)
        .select('severity, status')
        .in('status', ['open', 'investigating', 'mitigated']) as any);

      const incidents = (open ?? []) as Array<{ severity: IncidentSeverity; status: IncidentStatus }>;

      const by_severity: Record<IncidentSeverity, number> = { sev1: 0, sev2: 0, sev3: 0, sev4: 0 };
      const by_status: Record<IncidentStatus, number> = {
        open: 0, investigating: 0, mitigated: 0, resolved: 0,
      };

      for (const i of incidents) {
        by_severity[i.severity]++;
        by_status[i.status]++;
      }

      // MTTR from last 30 resolved incidents
      const { data: resolved } = await (supabase.from('incidents' as any)
        .select('created_at, resolved_at')
        .eq('status', 'resolved')
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(30) as any);

      let mttr = 0;
      const resolvedList = (resolved ?? []) as Array<{ created_at: string; resolved_at: string }>;
      if (resolvedList.length > 0) {
        const ttrs = resolvedList.map(r => (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 60_000);
        mttr = Math.round(ttrs.reduce((s, t) => s + t, 0) / ttrs.length);
      }

      // SLA breach count
      const { count: breachCount } = await (supabase.from('incidents' as any)
        .select('*', { count: 'exact', head: true })
        .eq('sla_breached', true) as any);

      // Uptime
      const { uptime_30d } = await availability.getCurrentUptime();

      return {
        total_open: incidents.length,
        by_severity,
        by_status,
        mttr_minutes: mttr,
        sla_breach_count: breachCount ?? 0,
        uptime_30d,
      };
    },

    async suggestRemediation(incidentId) {
      const incident = await this.getIncident(incidentId);
      if (!incident) return [];

      const suggestions: RemediationSuggestion[] = [];
      const isCritical = incident.severity === 'sev1' || incident.severity === 'sev2';
      if (!isCritical) return suggestions;

      const modules = incident.affected_modules ?? [];

      // 1. Rollback de módulo
      for (const mod of modules) {
        suggestions.push({
          action: 'rollback_module',
          label: `Rollback: ${mod}`,
          description: `Reverter o módulo "${mod}" para a última versão estável.`,
          affected_modules: [mod],
          priority: incident.severity === 'sev1' ? 'critical' : 'high',
          auto_applicable: true,
        });
      }

      // 2. Ativar sandbox
      suggestions.push({
        action: 'activate_sandbox',
        label: 'Ativar modo sandbox',
        description: 'Redirecionar tráfego para ambiente sandbox enquanto o incidente é investigado.',
        affected_modules: modules,
        priority: 'high',
        auto_applicable: false,
      });

      // 3. Desabilitar feature flags
      for (const mod of modules) {
        suggestions.push({
          action: 'disable_feature_flag',
          label: `Desabilitar feature flag: ${mod}`,
          description: `Desativar feature flags do módulo "${mod}" para reverter funcionalidades experimentais.`,
          affected_modules: [mod],
          priority: 'medium',
          auto_applicable: true,
        });
      }

      console.info(`[IncidentEngine] ${suggestions.length} remediation suggestions for ${incidentId} [${incident.severity}]`);
      return suggestions;
    },
  };
}

// ── Singleton ───────────────────────────────────────

let _instance: IncidentManagementEngineAPI | null = null;

export function getIncidentManagementEngine(): IncidentManagementEngineAPI {
  if (!_instance) _instance = createIncidentManagementEngine();
  return _instance;
}

export function resetIncidentManagementEngine(): void {
  _instance = null;
}
