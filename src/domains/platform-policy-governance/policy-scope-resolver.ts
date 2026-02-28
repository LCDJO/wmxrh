/**
 * PolicyScopeResolver — Determines which policies apply to a given tenant
 * based on policy type, mandatory flag, and grace period status.
 */

import type { PlatformPolicy, PolicyType } from './types';
import { PolicyRegistry } from './policy-registry';

export interface PolicyScope {
  policy: PlatformPolicy;
  isWithinGrace: boolean;
  graceDeadline: string | null;
  isOverdue: boolean;
}

export class PolicyScopeResolver {
  private registry = new PolicyRegistry();

  /** Get all policies applicable to a tenant, with grace period status */
  async resolve(tenantId: string, effectiveFrom?: string): Promise<PolicyScope[]> {
    const policies = await this.registry.getMandatory();
    const now = new Date();

    return policies.map(policy => {
      const baseDate = effectiveFrom ? new Date(effectiveFrom) : now;
      const graceMs = policy.grace_period_days * 86400000;
      const graceDeadline = new Date(baseDate.getTime() + graceMs);
      const isWithinGrace = now < graceDeadline;
      const isOverdue = now > graceDeadline;

      return {
        policy,
        isWithinGrace,
        graceDeadline: graceDeadline.toISOString(),
        isOverdue,
      };
    });
  }

  /** Filter policies by type */
  async getByType(policyType: PolicyType): Promise<PlatformPolicy[]> {
    const all = await this.registry.list();
    return all.filter(p => p.policy_type === policyType);
  }
}
