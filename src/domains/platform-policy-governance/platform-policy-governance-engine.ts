/**
 * PlatformPolicyGovernanceEngine — Facade
 *
 * Composes all sub-services into a single API surface:
 *   ├── PolicyRegistry
 *   ├── PolicyVersionManager
 *   ├── MandatoryAcceptanceController
 *   ├── AcceptanceAuditLog
 *   ├── PolicyRenderer
 *   └── PolicyScopeResolver
 */

import type {
  PlatformPolicyGovernanceAPI,
  PlatformPolicy,
  PolicyVersion,
  PolicyAcceptance,
  PendingPolicy,
  PublishVersionPayload,
  AcceptPolicyPayload,
} from './types';

import { PolicyRegistry } from './policy-registry';
import { PolicyVersionManager } from './policy-version-manager';
import { MandatoryAcceptanceController } from './mandatory-acceptance-controller';
import { AcceptanceAuditLog } from './acceptance-audit-log';
import { PolicyRenderer } from './policy-renderer';
import { PolicyScopeResolver } from './policy-scope-resolver';
import { PolicyNotifier } from './policy-notifier';

export class PlatformPolicyGovernanceEngine implements PlatformPolicyGovernanceAPI {
  readonly registry = new PolicyRegistry();
  readonly versions = new PolicyVersionManager();
  readonly acceptance = new MandatoryAcceptanceController();
  readonly auditLog = new AcceptanceAuditLog();
  readonly renderer = new PolicyRenderer();
  readonly scopeResolver = new PolicyScopeResolver();
  private notifier = new PolicyNotifier();

  async listPolicies(): Promise<PlatformPolicy[]> {
    return this.registry.list();
  }

  async getPolicy(policyId: string): Promise<{ policy: PlatformPolicy; version: PolicyVersion | null }> {
    const policy = await this.registry.getById(policyId);
    const version = await this.versions.getCurrent(policyId);
    return { policy, version };
  }

  async publishVersion(payload: PublishVersionPayload): Promise<PolicyVersion> {
    const version = await this.versions.publish(payload);

    // Invalidate acceptances if version or policy requires re-acceptance
    const policy = await this.registry.getById(payload.policy_id);
    if (policy.requires_re_acceptance_on_update || payload.requires_reacceptance) {
      await this.acceptance.invalidateAcceptances(payload.policy_id);

      // Notify all affected tenants asynchronously
      this.notifier.notifyPolicyUpdate(policy, version).catch(console.error);
    }

    return version;
  }

  async accept(payload: AcceptPolicyPayload): Promise<PolicyAcceptance> {
    return this.acceptance.accept(payload);
  }

  async getPendingForTenant(tenantId: string): Promise<PendingPolicy[]> {
    return this.acceptance.getPendingForTenant(tenantId);
  }

  async getAcceptanceHistory(tenantId: string): Promise<PolicyAcceptance[]> {
    return this.auditLog.getHistory(tenantId);
  }

  async isCompliant(tenantId: string): Promise<{ compliant: boolean; pending: PendingPolicy[] }> {
    return this.acceptance.isCompliant(tenantId);
  }
}

// Singleton
let _instance: PlatformPolicyGovernanceEngine | null = null;

export function getPlatformPolicyGovernanceEngine(): PlatformPolicyGovernanceEngine {
  if (!_instance) _instance = new PlatformPolicyGovernanceEngine();
  return _instance;
}
