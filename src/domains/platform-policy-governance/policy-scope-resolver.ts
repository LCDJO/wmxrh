/**
 * PolicyScopeResolver — Determines which policies apply to a given context
 * based on scope, mandatory flag, and grace period status.
 */

import type { PlatformPolicy, PolicyType, PolicyScope as PolicyScopeType } from './types';
import { PolicyRegistry } from './policy-registry';

export interface PolicyScope {
  policy: PlatformPolicy;
  isWithinGrace: boolean;
  graceDeadline: string | null;
  isOverdue: boolean;
}

export class PolicyScopeResolver {
  private registry = new PolicyRegistry();

  /** Get all mandatory policies applicable to a tenant, with grace period status */
  async resolve(tenantId: string, effectiveFrom?: string): Promise<PolicyScope[]> {
    const policies = await this.registry.getMandatory();
    return this.computeGrace(policies, effectiveFrom);
  }

  /** Resolve policies for a specific scope (e.g. marketplace, api) */
  async resolveByScope(scope: PolicyScopeType, effectiveFrom?: string): Promise<PolicyScope[]> {
    const policies = await this.registry.getByScope(scope);
    return this.computeGrace(policies, effectiveFrom);
  }

  /** Get policies that apply globally (SaaS-wide) */
  async getGlobal(): Promise<PlatformPolicy[]> {
    return this.registry.getByScope('global');
  }

  /** Get marketplace-specific policies */
  async getMarketplace(): Promise<PlatformPolicy[]> {
    return this.registry.getByScope('marketplace');
  }

  /** Get API usage policies */
  async getApiUsage(): Promise<PlatformPolicy[]> {
    return this.registry.getByScope('api');
  }

  /** Filter policies by type */
  async getByType(policyType: PolicyType): Promise<PlatformPolicy[]> {
    const all = await this.registry.list();
    return all.filter(p => p.policy_type === policyType);
  }

  private computeGrace(policies: PlatformPolicy[], effectiveFrom?: string): PolicyScope[] {
    const now = new Date();
    return policies.map(policy => {
      const baseDate = effectiveFrom ? new Date(effectiveFrom) : now;
      const graceMs = policy.grace_period_days * 86400000;
      const graceDeadline = new Date(baseDate.getTime() + graceMs);
      const isWithinGrace = now < graceDeadline;
      const isOverdue = now > graceDeadline;
      return { policy, isWithinGrace, graceDeadline: graceDeadline.toISOString(), isOverdue };
    });
  }
}
