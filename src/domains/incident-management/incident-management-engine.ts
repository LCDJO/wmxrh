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
    async evaluate(incident) {
      const config = await slaEngine.getConfig(incident.severity, incident.tenant_id);
      const createdAt = new Date(incident.created_at).getTime();
      const elapsed = (Date.now() - createdAt) / 60_000;

      if (elapsed < config.escalation_after_minutes) return null;

      const currentIdx = ESCALATION_ORDER.indexOf(incident.escalation_level);
      if (currentIdx >= ESCALATION_ORDER.length - 1) return null;

      // Calculate how many levels to skip based on time
      const levelsPassed = Math.floor(elapsed / config.escalation_after_minutes);
      const targetIdx = Math.min(currentIdx + levelsPassed, ESCALATION_ORDER.length - 1);

      if (targetIdx <= currentIdx) return null;
      return ESCALATION_ORDER[targetIdx];
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

function createClientNotificationService(): ClientNotificationServiceAPI {
  async function queueNotification(incidentId: string, tenantId: string | null, subject: string, body: string) {
    await (supabase.from('incident_notifications' as any).insert({
      incident_id: incidentId,
      tenant_id: tenantId,
      channel: 'in_app',
      recipient: tenantId ?? 'platform',
      subject,
      body,
      status: 'pending',
    } as any) as any);
  }

  return {
    async notifyIncidentCreated(incident) {
      await queueNotification(
        incident.id, incident.tenant_id,
        `[${incident.severity.toUpperCase()}] Incident: ${incident.title}`,
        `A new ${incident.severity} incident has been detected: ${incident.title}. Our team is investigating.`
      );
    },

    async notifyStatusUpdate(incident, update) {
      await queueNotification(
        incident.id, incident.tenant_id,
        `Incident Update: ${incident.title}`,
        `Status changed to ${update.new_status}: ${update.message}`
      );
    },

    async notifyResolution(incident) {
      await queueNotification(
        incident.id, incident.tenant_id,
        `Resolved: ${incident.title}`,
        `The incident "${incident.title}" has been resolved. ${incident.resolution_summary ?? ''}`
      );
    },

    async notifySLABreach(incident) {
      await queueNotification(
        incident.id, incident.tenant_id,
        `⚠️ SLA Breach: ${incident.title}`,
        `SLA has been breached for incident "${incident.title}" (severity: ${incident.severity}).`
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
  return {
    async create(incidentId, summary, createdBy) {
      const { data, error } = await (supabase.from('incident_postmortems' as any).insert({
        incident_id: incidentId,
        summary,
        created_by: createdBy ?? null,
        status: 'draft',
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
      await (supabase.from('incident_postmortems' as any).update({
        status: 'published',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      } as any).eq('id', postmortemId) as any);
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

      return withSLA;
    },

    async acknowledgeIncident(incidentId, userId) {
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
      }
    },

    async closeIncident(incidentId, userId) {
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
