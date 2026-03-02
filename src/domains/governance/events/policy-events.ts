/**
 * GovernanceCoreEngine — Policy Events
 *
 * All events emitted by the PolicyEngine.
 * Every action produces an append-only LegalEvent + AuditLog.
 */

export const POLICY_EVENTS = {
  PolicyCreated: 'PolicyCreated',
  PolicyUpdated: 'PolicyUpdated',
  PolicyArchived: 'PolicyArchived',
  PolicyRevoked: 'PolicyRevoked',

  VersionPublished: 'PolicyVersionPublished',
  VersionReacceptanceRequired: 'PolicyVersionReacceptanceRequired',

  AcceptanceRecorded: 'PolicyAcceptanceRecorded',
  AcceptanceInvalidated: 'PolicyAcceptanceInvalidated',

  LegalEventRecorded: 'PolicyLegalEventRecorded',
  AuditLogRecorded: 'PolicyAuditLogRecorded',
} as const;

export type PolicyEventType = typeof POLICY_EVENTS[keyof typeof POLICY_EVENTS];

// ── Payloads ──

export interface PolicyCreatedPayload {
  policy_id: string;
  slug: string;
  name: string;
  scope: string;
  category: string;
  requires_acceptance: boolean;
  grace_period_days: number;
  created_by: string;
}

export interface VersionPublishedPayload {
  policy_id: string;
  version_id: string;
  version_number: number;
  title: string;
  content_hash: string;
  change_summary: string | null;
  requires_reacceptance: boolean;
  published_by: string;
}

export interface AcceptanceRecordedPayload {
  policy_id: string;
  version_id: string;
  version_number: number;
  user_id: string;
  tenant_id: string;
  ip_address: string;
  user_agent: string;
  accepted_at: string;
  content_hash: string;
}

export interface AcceptanceInvalidatedPayload {
  policy_id: string;
  version_id: string;
  reason: string;
  invalidated_by: string;
  affected_tenant_ids: string[];
}
