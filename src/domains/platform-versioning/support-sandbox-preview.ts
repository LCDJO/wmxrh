/**
 * SupportModuleSandboxPreview — Allows previewing a specific SupportModule
 * version within a tenant sandbox before rolling it out globally.
 *
 * Usage:
 *   const preview = new SupportModuleSandboxPreview();
 *   await preview.activate({ tenant_id: '...', version_id: '...' });
 *   // tenant sees v2.1 while everyone else stays on v2.0
 *   await preview.deactivate('...');
 */
import { supabase } from '@/integrations/supabase/client';

export interface SandboxPreviewSession {
  id: string;
  tenant_id: string;
  module_id: string;
  version_id: string;            // support_module_versions.id being previewed
  status: 'active' | 'concluded' | 'aborted';
  feature_flags_override: Record<string, boolean | string | number>;
  activated_by: string;
  activated_at: string;
  concluded_at: string | null;
  conclusion_notes: string | null;
  promoted: boolean;             // true = version was promoted after preview
}

function rowToSession(row: Record<string, any>): SandboxPreviewSession {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    module_id: row.module_id,
    version_id: row.version_id,
    status: row.status,
    feature_flags_override: row.feature_flags_override ?? {},
    activated_by: row.activated_by,
    activated_at: row.activated_at,
    concluded_at: row.concluded_at ?? null,
    conclusion_notes: row.conclusion_notes ?? null,
    promoted: row.promoted ?? false,
  };
}

export class SupportModuleSandboxPreview {
  /**
   * Activate a preview session — the specified tenant will see the target version.
   */
  async activate(opts: {
    tenant_id: string;
    version_id: string;
    feature_flags_override?: Record<string, boolean | string | number>;
    activated_by: string;
  }): Promise<SandboxPreviewSession> {
    // Ensure no other active preview for same tenant+module
    const { data: existing } = await (supabase.from('support_sandbox_previews') as any)
      .select('id')
      .eq('tenant_id', opts.tenant_id)
      .eq('module_id', 'support_module')
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      throw new Error(
        `Tenant ${opts.tenant_id} already has an active preview session (${existing.id}). Conclude it first.`,
      );
    }

    const { data, error } = await (supabase.from('support_sandbox_previews') as any)
      .insert({
        tenant_id: opts.tenant_id,
        module_id: 'support_module',
        version_id: opts.version_id,
        status: 'active',
        feature_flags_override: opts.feature_flags_override ?? {},
        activated_by: opts.activated_by,
      })
      .select()
      .single();

    if (error) throw new Error(`SandboxPreview.activate: ${error.message}`);
    return rowToSession(data);
  }

  /**
   * Conclude a preview — optionally promote the version.
   */
  async conclude(
    sessionId: string,
    opts: { promoted?: boolean; notes?: string },
  ): Promise<SandboxPreviewSession | null> {
    const { data, error } = await (supabase.from('support_sandbox_previews') as any)
      .update({
        status: 'concluded',
        concluded_at: new Date().toISOString(),
        promoted: opts.promoted ?? false,
        conclusion_notes: opts.notes ?? null,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw new Error(`SandboxPreview.conclude: ${error.message}`);
    return data ? rowToSession(data) : null;
  }

  /**
   * Abort a preview session immediately.
   */
  async abort(sessionId: string, reason?: string): Promise<void> {
    await (supabase.from('support_sandbox_previews') as any)
      .update({
        status: 'aborted',
        concluded_at: new Date().toISOString(),
        conclusion_notes: reason ?? 'Aborted',
      })
      .eq('id', sessionId);
  }

  /**
   * Get active preview for a tenant (if any).
   * Used at runtime to resolve which version to serve.
   */
  async getActiveForTenant(tenantId: string): Promise<SandboxPreviewSession | null> {
    const { data } = await (supabase.from('support_sandbox_previews') as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('module_id', 'support_module')
      .eq('status', 'active')
      .maybeSingle();
    return data ? rowToSession(data) : null;
  }

  /**
   * List all preview sessions (history).
   */
  async listAll(limit = 50): Promise<SandboxPreviewSession[]> {
    const { data } = await (supabase.from('support_sandbox_previews') as any)
      .select('*')
      .eq('module_id', 'support_module')
      .order('activated_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToSession);
  }

  /**
   * Resolve the effective version for a tenant:
   * returns the preview version_id if active, otherwise null (use current released).
   */
  async resolveVersionForTenant(tenantId: string): Promise<string | null> {
    const active = await this.getActiveForTenant(tenantId);
    return active?.version_id ?? null;
  }
}
