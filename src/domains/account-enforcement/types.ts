/**
 * Account Enforcement Engine — Type definitions
 *
 * Unified Account Status Model applies to: Tenant, User, DeveloperApp
 */

// ── Account Status (unified across all entity types) ──
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned' | 'under_review';
export type AccountEntityType = 'tenant' | 'user' | 'developer_app';

export type EnforcementActionType = 'ban' | 'suspend' | 'restrict' | 'warn';
export type EnforcementSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EnforcementStatus = 'active' | 'appealed' | 'resolved' | 'expired' | 'revoked';
export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'denied' | 'escalated';
export type BanType = 'full' | 'module' | 'feature' | 'api';

export interface AccountEnforcement {
  id: string;
  tenant_id: string;
  entity_type: AccountEntityType;
  entity_id: string | null;
  action_type: EnforcementActionType;
  reason: string;
  reason_category: string;
  severity: EnforcementSeverity;
  status: EnforcementStatus;
  enforced_by: string | null;
  enforced_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  risk_score_at_enforcement: number | null;
  related_incident_id: string | null;
  related_fraud_log_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BanRegistryEntry {
  id: string;
  tenant_id: string;
  enforcement_id: string | null;
  ban_type: BanType;
  scope_detail: string | null;
  is_permanent: boolean;
  banned_by: string | null;
  banned_at: string;
  unbanned_at: string | null;
  unbanned_by: string | null;
  unban_reason: string | null;
  created_at: string;
}

export interface EnforcementAppeal {
  id: string;
  enforcement_id: string;
  tenant_id: string;
  appealed_by: string | null;
  appeal_reason: string;
  supporting_evidence: unknown[];
  status: AppealStatus;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnforceAccountPayload {
  tenant_id: string;
  entity_type?: AccountEntityType;
  entity_id?: string;
  action_type: EnforcementActionType;
  reason: string;
  reason_category?: string;
  severity?: EnforcementSeverity;
  expires_at?: string;
  ban_type?: BanType;
  scope_detail?: string;
  is_permanent?: boolean;
  related_incident_id?: string;
  related_fraud_log_id?: string;
  notes?: string;
}

export interface AppealPayload {
  enforcement_id: string;
  appeal_reason: string;
  supporting_evidence?: unknown[];
}

export interface ReviewAppealPayload {
  appeal_id: string;
  status: 'approved' | 'denied' | 'escalated';
  reviewer_notes?: string;
}

/** Resolved account status for any entity */
export interface AccountStatusInfo {
  entity_type: AccountEntityType;
  entity_id: string;
  account_status: AccountStatus;
  active_enforcements: AccountEnforcement[];
}

export interface AccountEnforcementEngineAPI {
  /** Check if a tenant is currently banned or suspended */
  isTenantRestricted(tenantId: string): Promise<{ restricted: boolean; enforcements: AccountEnforcement[] }>;
  /** Check restriction for any entity type */
  isEntityRestricted(entityType: AccountEntityType, entityId: string): Promise<AccountStatusInfo>;
  /** Enforce an action on an account (tenant, user, or developer_app) */
  enforce(payload: EnforceAccountPayload): Promise<AccountEnforcement>;
  /** Revoke an active enforcement */
  revoke(enforcementId: string, reason: string): Promise<void>;
  /** Submit an appeal */
  appeal(payload: AppealPayload): Promise<EnforcementAppeal>;
  /** Review an appeal */
  reviewAppeal(payload: ReviewAppealPayload): Promise<void>;
  /** Get enforcement history for a tenant */
  getHistory(tenantId: string): Promise<AccountEnforcement[]>;
  /** Get ban registry for a tenant */
  getBanRegistry(tenantId: string): Promise<BanRegistryEntry[]>;
}
