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
import { GOVERNANCE_KERNEL_EVENTS } from './governance-events';
import { createGlobalEventKernel } from '@/domains/platform-os/global-event-kernel';

const kernel = createGlobalEventKernel();

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

    kernel.emit(GOVERNANCE_KERNEL_EVENTS.PolicyVersionPublished, 'GovernanceEngine', {
      policy_id: payload.policy_id,
      version_number: version.version_number,
      title: version.title,
      requires_reacceptance: payload.requires_reacceptance ?? false,
      published_by: 'system',
    });

    return version;
  }

  async accept(payload: AcceptPolicyPayload): Promise<PolicyAcceptance> {
    const result = await this.acceptance.accept(payload);

    kernel.emit(GOVERNANCE_KERNEL_EVENTS.PolicyAccepted, 'GovernanceEngine', {
      policy_id: payload.policy_id,
      version_id: payload.policy_version_id,
      user_id: 'system',
      tenant_id: payload.tenant_id,
      accepted_at: Date.now(),
    });

    return result;
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
