/**
 * PolicyVersionManager — Immutable versioning for policy content.
 * New versions never overwrite old ones — append-only model.
 * Versions are protected by DB triggers: no DELETE, no destructive UPDATE.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PolicyVersion, PublishVersionPayload } from './types';

export interface VersionDiff {
  from: PolicyVersion;
  to: PolicyVersion;
  changeSummary: string | null;
  contentChanged: boolean;
  requiresReacceptance: boolean;
}

export class PolicyVersionManager {
  async getCurrent(policyId: string): Promise<PolicyVersion | null> {
    const { data: policy } = await supabase
      .from('platform_policies')
      .select('current_version_id')
      .eq('id', policyId)
      .single();

    if (!(policy as any)?.current_version_id) return null;

    const { data } = await supabase
      .from('platform_policy_versions')
      .select('*')
      .eq('id', (policy as any).current_version_id)
      .single();

    return data as unknown as PolicyVersion | null;
  }

  async getById(versionId: string): Promise<PolicyVersion | null> {
    const { data } = await supabase
      .from('platform_policy_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    return data as unknown as PolicyVersion | null;
  }

  async getAll(policyId: string): Promise<PolicyVersion[]> {
    const { data } = await supabase
      .from('platform_policy_versions')
      .select('*')
      .eq('policy_id', policyId)
      .order('version_number', { ascending: false });

    return (data ?? []) as unknown as PolicyVersion[];
  }

  /** Compare two versions side-by-side */
  async compare(versionIdA: string, versionIdB: string): Promise<VersionDiff> {
    const [a, b] = await Promise.all([this.getById(versionIdA), this.getById(versionIdB)]);
    if (!a || !b) throw new Error('One or both versions not found');
    const [from, to] = a.version_number < b.version_number ? [a, b] : [b, a];
    return {
      from,
      to,
      changeSummary: to.change_summary,
      contentChanged: from.content_hash !== to.content_hash,
      requiresReacceptance: to.requires_reacceptance,
    };
  }

  async publish(payload: PublishVersionPayload): Promise<PolicyVersion> {
    const { data: userData } = await supabase.auth.getUser();

    // Get next version number
    const { data: existing } = await supabase
      .from('platform_policy_versions')
      .select('version_number')
      .eq('policy_id', payload.policy_id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = existing?.length ? (existing[0] as any).version_number + 1 : 1;
    const now = new Date().toISOString();

    // Mark previous versions as not current
    await supabase
      .from('platform_policy_versions')
      .update({ is_current: false } as any)
      .eq('policy_id', payload.policy_id)
      .eq('is_current', true);

    const { data, error } = await supabase
      .from('platform_policy_versions')
      .insert({
        policy_id: payload.policy_id,
        version_number: nextVersion,
        title: payload.title,
        content_html: payload.content_html,
        content_plain: payload.content_plain ?? null,
        content_hash: payload.content_html ? this.hashContent(payload.content_html) : null,
        change_summary: payload.change_summary ?? null,
        published_by: userData?.user?.id,
        published_at: now,
        is_current: true,
        effective_from: payload.effective_from ?? now,
        requires_reacceptance: payload.requires_reacceptance ?? false,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Update policy's current_version_id
    await supabase
      .from('platform_policies')
      .update({ current_version_id: (data as any).id, updated_at: now } as any)
      .eq('id', payload.policy_id);

    return data as unknown as PolicyVersion;
  }

  private hashContent(html: string): string {
    // Simple hash for content fingerprinting (frontend-safe)
    let hash = 0;
    for (let i = 0; i < html.length; i++) {
      const char = html.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  }
}
