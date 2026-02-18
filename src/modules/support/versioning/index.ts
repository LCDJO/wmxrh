/**
 * SupportModuleVersion — Dual-side versioning for the Support module.
 *
 * Registers `platform_console_changes` and `tenant_ui_changes` as scoped
 * changelog entries in `platform_changelogs`, and persists semver snapshots
 * in `module_versions` with `tenant_app_version` / `platform_console_version`.
 */
import { supabase } from '@/integrations/supabase/client';
import { SUPPORT_MODULE_ID, SUPPORT_MODULE_LAYERS } from '../manifest';

// ── Types ──

export type VersionScope = 'tenant_side' | 'platform_side';

export interface SupportChangeEntry {
  title: string;
  description?: string;
  changeType: 'feature' | 'fix' | 'improvement' | 'breaking';
  tags?: string[];
}

export interface SupportVersionPayload {
  /** Semver string, e.g. "1.3.0" */
  tenantAppVersion: string;
  /** Semver string, e.g. "1.4.0" */
  platformConsoleVersion: string;
  /** Changes to the platform console (agent-side) */
  platformConsoleChanges: SupportChangeEntry[];
  /** Changes to the tenant UI (client-side) */
  tenantUiChanges: SupportChangeEntry[];
  /** Global changelog summary (markdown) */
  changelogSummary: string;
  /** Has breaking changes? */
  breakingChanges?: boolean;
  /** Who is publishing */
  author: string;
}

export interface SupportVersionRecord {
  id: string;
  moduleId: string;
  versionTag: string;
  tenantAppVersion: string | null;
  platformConsoleVersion: string | null;
  status: string;
  changelogSummary: string;
  breakingChanges: boolean;
  createdAt: string;
  releasedAt: string | null;
}

// ── Helpers ──

function parseSemver(v: string): { major: number; minor: number; patch: number } {
  const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number);
  return { major, minor, patch };
}

// ── Service ──

export const SupportModuleVersion = {
  /**
   * Register a new dual-side version for the support module.
   * Creates a `module_versions` row and individual `platform_changelogs` entries.
   */
  async publish(payload: SupportVersionPayload): Promise<SupportVersionRecord> {
    const sv = parseSemver(payload.platformConsoleVersion);
    const versionTag = `v${payload.platformConsoleVersion}`;

    // 1. Insert module_versions row
    const { data: version, error: vErr } = await supabase
      .from('module_versions')
      .insert({
        module_id: SUPPORT_MODULE_ID,
        version_major: sv.major,
        version_minor: sv.minor,
        version_patch: sv.patch,
        version_tag: versionTag,
        status: 'draft',
        breaking_changes: payload.breakingChanges ?? false,
        dependencies: {},
        changelog_summary: payload.changelogSummary,
        created_by: payload.author,
        tenant_app_version: payload.tenantAppVersion,
        platform_console_version: payload.platformConsoleVersion,
      })
      .select()
      .single();

    if (vErr || !version) throw new Error(vErr?.message ?? 'Failed to create module version');

    // 2. Insert changelog entries for platform console changes
    const platformEntries = payload.platformConsoleChanges.map(c => ({
      module_id: SUPPORT_MODULE_ID,
      entity_type: 'support_console',
      entity_id: SUPPORT_MODULE_LAYERS.PLATFORM,
      change_type: c.changeType,
      version_tag: versionTag,
      payload_diff: {},
      changed_by: payload.author,
      scope: 'platform_side' as const,
      entity_scope: 'platform_side',
      title: c.title,
      description: c.description ?? '',
      author: payload.author,
      linked_version_id: version.id,
      tags: c.tags ?? [],
      category: 'support',
    }));

    // 3. Insert changelog entries for tenant UI changes
    const tenantEntries = payload.tenantUiChanges.map(c => ({
      module_id: SUPPORT_MODULE_ID,
      entity_type: 'support_tenant_ui',
      entity_id: SUPPORT_MODULE_LAYERS.TENANT,
      change_type: c.changeType,
      version_tag: versionTag,
      payload_diff: {},
      changed_by: payload.author,
      scope: 'tenant_side' as const,
      entity_scope: 'tenant_side',
      title: c.title,
      description: c.description ?? '',
      author: payload.author,
      linked_version_id: version.id,
      tags: c.tags ?? [],
      category: 'support',
    }));

    const allEntries = [...platformEntries, ...tenantEntries];
    if (allEntries.length > 0) {
      const { error: cErr } = await supabase
        .from('platform_changelogs')
        .insert(allEntries);
      if (cErr) throw new Error(cErr.message);
    }

    return {
      id: version.id,
      moduleId: version.module_id,
      versionTag: version.version_tag,
      tenantAppVersion: version.tenant_app_version,
      platformConsoleVersion: version.platform_console_version,
      status: version.status,
      changelogSummary: version.changelog_summary,
      breakingChanges: version.breaking_changes,
      createdAt: version.created_at,
      releasedAt: version.released_at,
    };
  },

  /**
   * Finalize a draft version → 'released'.
   */
  async release(versionId: string): Promise<void> {
    const { error } = await supabase
      .from('module_versions')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', versionId)
      .eq('module_id', SUPPORT_MODULE_ID);
    if (error) throw new Error(error.message);
  },

  /**
   * List all versions for the support module, newest first.
   */
  async listVersions(): Promise<SupportVersionRecord[]> {
    const { data, error } = await supabase
      .from('module_versions')
      .select('*')
      .eq('module_id', SUPPORT_MODULE_ID)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(v => ({
      id: v.id,
      moduleId: v.module_id,
      versionTag: v.version_tag,
      tenantAppVersion: v.tenant_app_version,
      platformConsoleVersion: v.platform_console_version,
      status: v.status,
      changelogSummary: v.changelog_summary,
      breakingChanges: v.breaking_changes,
      createdAt: v.created_at,
      releasedAt: v.released_at,
    }));
  },

  /**
   * Get changelog entries for a specific version, grouped by scope.
   */
  async getChangelog(versionId: string): Promise<{
    platformConsoleChanges: Array<{ title: string; description: string; changeType: string; tags: string[] }>;
    tenantUiChanges: Array<{ title: string; description: string; changeType: string; tags: string[] }>;
  }> {
    const { data, error } = await supabase
      .from('platform_changelogs')
      .select('title, description, change_type, tags, entity_scope')
      .eq('linked_version_id', versionId)
      .eq('module_id', SUPPORT_MODULE_ID);

    if (error) throw new Error(error.message);

    const entries = data ?? [];
    return {
      platformConsoleChanges: entries
        .filter(e => e.entity_scope === 'platform_side')
        .map(e => ({ title: e.title ?? '', description: e.description ?? '', changeType: e.change_type, tags: e.tags ?? [] })),
      tenantUiChanges: entries
        .filter(e => e.entity_scope === 'tenant_side')
        .map(e => ({ title: e.title ?? '', description: e.description ?? '', changeType: e.change_type, tags: e.tags ?? [] })),
    };
  },

  /**
   * Get the current (latest released) version.
   */
  async getCurrentVersion(): Promise<SupportVersionRecord | null> {
    const { data, error } = await supabase
      .from('module_versions')
      .select('*')
      .eq('module_id', SUPPORT_MODULE_ID)
      .eq('status', 'released')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      moduleId: data.module_id,
      versionTag: data.version_tag,
      tenantAppVersion: data.tenant_app_version,
      platformConsoleVersion: data.platform_console_version,
      status: data.status,
      changelogSummary: data.changelog_summary,
      breakingChanges: data.breaking_changes,
      createdAt: data.created_at,
      releasedAt: data.released_at,
    };
  },
};
