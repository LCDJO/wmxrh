/**
 * MandatoryAcceptanceController — Enforces acceptance of mandatory policies.
 * Resolves pending policies per tenant and checks compliance.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlatformPolicy, PolicyVersion, PolicyAcceptance, PendingPolicy, AcceptPolicyPayload } from './types';
import { PolicyRegistry } from './policy-registry';
import { PolicyVersionManager } from './policy-version-manager';

export class MandatoryAcceptanceController {
  private registry = new PolicyRegistry();
  private versions = new PolicyVersionManager();

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
    const mandatory = await this.registry.getMandatory();

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

      if (!needsAction) continue;

      const version = await this.versions.getCurrent(policy.id);
      if (!version) continue;

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

    return pending;
  }

  async isCompliant(tenantId: string): Promise<{ compliant: boolean; pending: PendingPolicy[] }> {
    const pending = await this.getPendingForTenant(tenantId);
    return { compliant: pending.length === 0, pending };
  }

  /** Invalidate all acceptances when policy requires re-acceptance */
  async invalidateAcceptances(policyId: string): Promise<void> {
    await supabase
      .from('platform_policy_acceptances')
      .update({ is_current: false } as any)
      .eq('policy_id', policyId)
      .eq('is_current', true);
  }
}
