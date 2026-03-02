/**
 * GovernanceCoreEngine — Sanction Events
 *
 * Events emitted by the SanctionEngine.
 * Every sanction action produces both a LegalEvent and an AuditLog entry.
 */

export const SANCTION_EVENTS = {
  // Status transitions
  AccountRestricted: 'SanctionAccountRestricted',
  AccountSuspended: 'SanctionAccountSuspended',
  AccountBanned: 'SanctionAccountBanned',
  AccountReactivated: 'SanctionAccountReactivated',

  // Lifecycle
  SanctionCreated: 'SanctionCreated',
  SanctionEscalated: 'SanctionEscalated',
  SanctionContested: 'SanctionContested',
  SanctionRevoked: 'SanctionRevoked',
  SanctionExpired: 'SanctionExpired',

  // Audit
  LegalEventRecorded: 'SanctionLegalEventRecorded',
  AuditLogRecorded: 'SanctionAuditLogRecorded',
} as const;

export type SanctionEventType = typeof SANCTION_EVENTS[keyof typeof SANCTION_EVENTS];

// ── Payloads ──

export type SanctionAccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';

export interface SanctionCreatedPayload {
  entity_id: string;
  entity_type: 'employee' | 'tenant' | 'user' | 'api_client';
  sanction_type: string;
  reason: string;
  legal_basis: string | null;
  severity: string;
  previous_status: SanctionAccountStatus;
  new_status: SanctionAccountStatus;
  effective_date: string;
  expiry_date: string | null;
  duration_days: number | null;
  issued_by: string;
  witness_ids: string[];
  attachments: string[];
  notes: string | null;
}

export interface SanctionStatusChangePayload {
  entity_id: string;
  entity_type: string;
  previous_status: SanctionAccountStatus;
  new_status: SanctionAccountStatus;
  reason: string;
  changed_by: string;
}

export interface SanctionEscalatedPayload {
  entity_id: string;
  entity_type: string;
  from_sanction_id: string;
  previous_level: string;
  new_level: string;
  reason: string;
  escalated_by: string;
}

export interface SanctionContestedPayload {
  entity_id: string;
  sanction_id: string;
  contest_reason: string;
  contested_by: string;
  evidence_ids: string[];
}

export interface SanctionRevokedPayload {
  entity_id: string;
  sanction_id: string;
  revocation_reason: string;
  revoked_by: string;
  restore_status: SanctionAccountStatus;
}
