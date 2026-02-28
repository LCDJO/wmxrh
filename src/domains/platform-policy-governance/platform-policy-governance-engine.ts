/**
 * PlatformPolicyGovernanceEngine
 *
 * Manages platform-wide policies, legal versioning, and mandatory acceptance tracking.
 * Integrates with: VersioningEngine, AuditLogger, ControlPlane.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  PlatformPolicyGovernanceAPI,
  PlatformPolicy,
  PolicyVersion,
  PolicyAcceptance,
  PendingPolicy,
  PublishVersionPayload,
  AcceptPolicyPayload,
} from './types';

export class PlatformPolicyGovernanceEngine implements PlatformPolicyGovernanceAPI {

  async listPolicies(): Promise<PlatformPolicy[]> {
    const { data } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    return (data ?? []) as unknown as PlatformPolicy[];
  }

  async getPolicy(policyId: string): Promise<{ policy: PlatformPolicy; version: PolicyVersion | null }> {
    const { data: policy } = await supabase
      .from('platform_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (!policy) throw new Error('Policy not found');

    let version: PolicyVersion | null = null;
    if ((policy as any).current_version_id) {
      const { data: v } = await supabase
        .from('platform_policy_versions')
        .select('*')
        .eq('id', (policy as any).current_version_id)
        .single();
      version = v as unknown as PolicyVersion;
    }

    return { policy: policy as unknown as PlatformPolicy, version };
  }

  async publishVersion(payload: PublishVersionPayload): Promise<PolicyVersion> {
    const { data: userData } = await supabase.auth.getUser();

    // Get next version number
    const { data: existing } = await supabase
      .from('platform_policy_versions')
      .select('version_number')
      .eq('policy_id', payload.policy_id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0
      ? (existing[0] as any).version_number + 1
      : 1;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('platform_policy_versions')
      .insert({
        policy_id: payload.policy_id,
        version_number: nextVersion,
        title: payload.title,
        content_html: payload.content_html,
        content_plain: payload.content_plain ?? null,
        change_summary: payload.change_summary ?? null,
        published_by: userData?.user?.id,
        published_at: now,
        is_current: true,
        effective_from: payload.effective_from ?? now,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // If policy requires re-acceptance, invalidate current acceptances
    const { data: policy } = await supabase
      .from('platform_policies')
      .select('requires_re_acceptance_on_update')
      .eq('id', payload.policy_id)
      .single();

    if ((policy as any)?.requires_re_acceptance_on_update) {
      await supabase
        .from('platform_policy_acceptances')
        .update({ is_current: false } as any)
        .eq('policy_id', payload.policy_id)
        .eq('is_current', true);
    }

    return data as unknown as PolicyVersion;
  }

  async accept(payload: AcceptPolicyPayload): Promise<PolicyAcceptance> {
    const { data: userData } = await supabase.auth.getUser();

    // Invalidate previous acceptances for this policy+tenant
    await supabase
      .from('platform_policy_acceptances')
      .update({ is_current: false } as any)
      .eq('policy_id', payload.policy_id)
      .eq('tenant_id', payload.tenant_id)
      .eq('is_current', true);

    const { data, error } = await supabase
      .from('platform_policy_acceptances')
      .insert({
        policy_id: payload.policy_id,
        policy_version_id: payload.policy_version_id,
        tenant_id: payload.tenant_id,
        accepted_by: userData?.user?.id ?? payload.tenant_id,
        acceptance_method: payload.acceptance_method ?? 'click',
        is_current: true,
        metadata: {},
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PolicyAcceptance;
  }

  async getPendingForTenant(tenantId: string): Promise<PendingPolicy[]> {
    const policies = await this.listPolicies();
    const mandatory = policies.filter(p => p.is_mandatory);

    const { data: acceptances } = await supabase
      .from('platform_policy_acceptances')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_current', true);

    const acceptMap = new Map<string, PolicyAcceptance>();
    for (const a of (acceptances ?? []) as unknown as PolicyAcceptance[]) {
      acceptMap.set(a.policy_id, a);
    }

    const pending: PendingPolicy[] = [];

    for (const policy of mandatory) {
      const acceptance = acceptMap.get(policy.id) ?? null;
      const needsAction = !acceptance || (
        policy.current_version_id !== null &&
        acceptance.policy_version_id !== policy.current_version_id
      );

      let version: PolicyVersion | null = null;
      if (policy.current_version_id) {
        const { data: v } = await supabase
          .from('platform_policy_versions')
          .select('*')
          .eq('id', policy.current_version_id)
          .single();
        version = v as unknown as PolicyVersion;
      }

      if (needsAction && version) {
        const graceDeadline = version.effective_from
          ? new Date(new Date(version.effective_from).getTime() + policy.grace_period_days * 86400000).toISOString()
          : null;

        pending.push({
          policy,
          currentVersion: version,
          acceptance,
          requiresAction: true,
          graceDeadline,
        });
      }
    }

    return pending;
  }

  async getAcceptanceHistory(tenantId: string): Promise<PolicyAcceptance[]> {
    const { data } = await supabase
      .from('platform_policy_acceptances')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('accepted_at', { ascending: false });

    return (data ?? []) as unknown as PolicyAcceptance[];
  }

  async isCompliant(tenantId: string): Promise<{ compliant: boolean; pending: PendingPolicy[] }> {
    const pending = await this.getPendingForTenant(tenantId);
    return { compliant: pending.length === 0, pending };
  }
}

// Singleton
let _instance: PlatformPolicyGovernanceEngine | null = null;

export function getPlatformPolicyGovernanceEngine(): PlatformPolicyGovernanceEngine {
  if (!_instance) _instance = new PlatformPolicyGovernanceEngine();
  return _instance;
}
