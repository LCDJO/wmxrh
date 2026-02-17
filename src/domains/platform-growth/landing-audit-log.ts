/**
 * LandingAuditLog — Centralized audit trail for landing page lifecycle events.
 *
 * Standardized action_type values:
 *   - draft_deleted
 *   - version_created
 *   - version_published
 *   - version_superseded
 *
 * Each entry is persisted to `audit_logs` and emitted as a platform event.
 */
import { supabase } from '@/integrations/supabase/client';
import { platformEvents } from '@/domains/platform/platform-events';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type LandingAuditActionType =
  | 'draft_deleted'
  | 'version_created'
  | 'version_published'
  | 'version_superseded';

export interface LandingAuditEntry {
  action_type: LandingAuditActionType;
  landing_page_id: string;
  version_id?: string;
  version_number?: number;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  metadata?: Record<string, unknown>;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
}

export interface LandingAuditRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  metadata: Record<string, unknown>;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

// ═══════════════════════════════════
// Service
// ═══════════════════════════════════

class LandingAuditLogService {
  private readonly TENANT_ID = '00000000-0000-0000-0000-000000000000'; // platform-level

  /**
   * Record a landing page audit event.
   * Persists to audit_logs and emits the corresponding platform event.
   */
  async record(entry: LandingAuditEntry): Promise<void> {
    const entityId = entry.version_id ?? entry.landing_page_id;
    const entityType = entry.version_id ? 'landing_page_version' : 'landing_page';

    // 1. Persist to audit_logs
    await (supabase.from('audit_logs') as any).insert({
      tenant_id: this.TENANT_ID,
      entity_type: entityType,
      entity_id: entityId,
      action: entry.action_type,
      user_id: entry.actor_id,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      metadata: {
        landing_page_id: entry.landing_page_id,
        version_id: entry.version_id ?? null,
        version_number: entry.version_number ?? null,
        actor_role: entry.actor_role,
        actor_email: entry.actor_email,
        ...entry.metadata,
      },
    });

    // 2. Emit platform event
    this.emitEvent(entry);

    // 3. Observability: increment Prometheus-compatible counters
    this.recordMetric(entry);
  }

  // ── Observability ──────────────────────────────

  private recordMetric(entry: LandingAuditEntry): void {
    const mc = getMetricsCollector();
    const labels = { landing_page_id: entry.landing_page_id };

    switch (entry.action_type) {
      case 'version_created':
        mc.increment('landing_versions_total', labels);
        break;
      case 'draft_deleted':
        mc.increment('landing_draft_deleted_total', labels);
        break;
      case 'version_published':
        mc.increment('landing_publish_new_version_total', labels);
        break;
      case 'version_superseded':
        // No dedicated counter requested, but tracked via landing_versions_total lifecycle
        break;
    }
  }

  // ── Convenience methods ──────────────────────────

  async draftDeleted(opts: {
    landingPageId: string;
    pageName: string;
    pageSlug: string;
    actorId: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<void> {
    await this.record({
      action_type: 'draft_deleted',
      landing_page_id: opts.landingPageId,
      actor_id: opts.actorId,
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole,
      old_value: { name: opts.pageName, slug: opts.pageSlug, status: 'draft' },
      new_value: { deleted_at: new Date().toISOString() },
      metadata: { page_name: opts.pageName, page_slug: opts.pageSlug },
    });
  }

  async versionCreated(opts: {
    landingPageId: string;
    versionId: string;
    versionNumber: number;
    actorId: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<void> {
    await this.record({
      action_type: 'version_created',
      landing_page_id: opts.landingPageId,
      version_id: opts.versionId,
      version_number: opts.versionNumber,
      actor_id: opts.actorId,
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole,
      new_value: { status: 'draft', version_number: opts.versionNumber },
    });
  }

  async versionPublished(opts: {
    landingPageId: string;
    versionId: string;
    versionNumber: number;
    actorId: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<void> {
    await this.record({
      action_type: 'version_published',
      landing_page_id: opts.landingPageId,
      version_id: opts.versionId,
      version_number: opts.versionNumber,
      actor_id: opts.actorId,
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole,
      old_value: { status: 'approved' },
      new_value: { status: 'published', published_at: new Date().toISOString() },
    });
  }

  async versionSuperseded(opts: {
    landingPageId: string;
    versionId: string;
    versionNumber: number;
    supersededByVersionId: string;
    newActiveVersion: number;
    actorId: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<void> {
    await this.record({
      action_type: 'version_superseded',
      landing_page_id: opts.landingPageId,
      version_id: opts.versionId,
      version_number: opts.versionNumber,
      actor_id: opts.actorId,
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole,
      old_value: { status: 'published' },
      new_value: { status: 'superseded', superseded_by: opts.supersededByVersionId },
      metadata: { new_active_version: opts.newActiveVersion },
    });
  }

  // ── Query ──────────────────────────────────────

  /**
   * Fetch audit trail for a landing page (all action types).
   */
  async getByLandingPage(landingPageId: string): Promise<LandingAuditRecord[]> {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'landing_page')
      .eq('entity_id', landingPageId)
      .in('action', ['draft_deleted', 'version_created', 'version_published', 'version_superseded'])
      .order('created_at', { ascending: false });

    // Also fetch version-level entries
    const { data: versionData } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'landing_page_version')
      .in('action', ['draft_deleted', 'version_created', 'version_published', 'version_superseded'])
      .order('created_at', { ascending: false });

    // Filter version entries by landing_page_id in metadata
    const vEntries = (versionData ?? []).filter(
      (e: any) => e.metadata?.landing_page_id === landingPageId
    );

    const all = [...(data ?? []), ...vEntries].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return all as unknown as LandingAuditRecord[];
  }

  // ── Platform Event Emitter ─────────────────────

  private emitEvent(entry: LandingAuditEntry): void {
    switch (entry.action_type) {
      case 'draft_deleted':
        platformEvents.landingDraftDeleted(entry.actor_id, {
          landingPageId: entry.landing_page_id,
          pageName: entry.metadata?.page_name as string ?? '',
        });
        break;
      case 'version_created':
        platformEvents.landingVersionCreated(entry.actor_id, {
          landingPageId: entry.landing_page_id,
          versionId: entry.version_id!,
          versionNumber: entry.version_number!,
        });
        break;
      case 'version_published':
        platformEvents.landingVersionPublished(entry.actor_id, {
          landingPageId: entry.landing_page_id,
          versionId: entry.version_id!,
          versionNumber: entry.version_number!,
        });
        break;
      case 'version_superseded':
        platformEvents.landingVersionSuperseded(entry.actor_id, {
          landingPageId: entry.landing_page_id,
          versionId: entry.version_id!,
          versionNumber: entry.version_number!,
          supersededBy: entry.new_value?.superseded_by as string ?? '',
        });
        break;
    }
  }
}

export const landingAuditLog = new LandingAuditLogService();
