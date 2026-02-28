/**
 * Platform Policy & Terms Governance — Type definitions
 */

export type PolicyCategory = 'terms_of_use' | 'privacy' | 'security' | 'billing' | 'conduct';
export type PolicyAppliesTo = 'tenant' | 'user' | 'developer';
export type PolicyType = 'terms_of_service' | 'acceptable_use' | 'privacy_policy' | 'data_processing' | 'sla' | 'custom';
export type AcceptanceMethod = 'click' | 'signature' | 'api' | 'migration';

export interface PlatformPolicy {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  policy_type: PolicyType;
  category: PolicyCategory;
  applies_to: PolicyAppliesTo;
  is_mandatory: boolean;
  is_active: boolean;
  current_version_id: string | null;
  requires_re_acceptance_on_update: boolean;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  title: string;
  content_html: string;
  content_plain: string | null;
  content_hash: string | null;
  change_summary: string | null;
  published_by: string | null;
  published_at: string | null;
  is_current: boolean;
  effective_from: string | null;
  created_at: string;
}

export interface PolicyAcceptance {
  id: string;
  policy_id: string;
  policy_version_id: string;
  tenant_id: string;
  accepted_by: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  acceptance_method: AcceptanceMethod;
  is_current: boolean;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
}

export interface PendingPolicy {
  policy: PlatformPolicy;
  currentVersion: PolicyVersion;
  acceptance: PolicyAcceptance | null;
  requiresAction: boolean;
  graceDeadline: string | null;
}

export interface PublishVersionPayload {
  policy_id: string;
  title: string;
  content_html: string;
  content_plain?: string;
  change_summary?: string;
  effective_from?: string;
}

export interface AcceptPolicyPayload {
  policy_id: string;
  policy_version_id: string;
  tenant_id: string;
  acceptance_method?: AcceptanceMethod;
}

export interface PlatformPolicyGovernanceAPI {
  /** List all active policies */
  listPolicies(): Promise<PlatformPolicy[]>;
  /** Get a policy with its current version */
  getPolicy(policyId: string): Promise<{ policy: PlatformPolicy; version: PolicyVersion | null }>;
  /** Publish a new version of a policy */
  publishVersion(payload: PublishVersionPayload): Promise<PolicyVersion>;
  /** Accept a policy version for a tenant */
  accept(payload: AcceptPolicyPayload): Promise<PolicyAcceptance>;
  /** Get pending policies for a tenant (needs acceptance) */
  getPendingForTenant(tenantId: string): Promise<PendingPolicy[]>;
  /** Get acceptance history for a tenant */
  getAcceptanceHistory(tenantId: string): Promise<PolicyAcceptance[]>;
  /** Check if tenant has accepted all mandatory policies */
  isCompliant(tenantId: string): Promise<{ compliant: boolean; pending: PendingPolicy[] }>;
}
