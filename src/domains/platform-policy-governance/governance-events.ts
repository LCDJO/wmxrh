/**
 * Platform Policy Governance — Domain Events
 *
 * Canonical events emitted through the GlobalEventKernel
 * for cross-module integration.
 */

// ════════════════════════════════════
// EVENT CONSTANTS
// ════════════════════════════════════

export const GOVERNANCE_KERNEL_EVENTS = {
  AccountBanned: 'governance:AccountBanned',
  AccountSuspended: 'governance:AccountSuspended',
  AppealSubmitted: 'governance:AppealSubmitted',
  AppealResolved: 'governance:AppealResolved',
  PolicyVersionPublished: 'governance:PolicyVersionPublished',
  PolicyAccepted: 'governance:PolicyAccepted',
} as const;

export type GovernanceKernelEvent =
  typeof GOVERNANCE_KERNEL_EVENTS[keyof typeof GOVERNANCE_KERNEL_EVENTS];

// ════════════════════════════════════
// PAYLOAD TYPES
// ════════════════════════════════════

export interface AccountBannedPayload {
  tenant_id: string;
  entity_id: string;
  entity_type: string;
  ban_type: string;
  reason_category: string;
  severity_level: string;
  is_permanent: boolean;
  banned_by: string | null;
}

export interface AccountSuspendedPayload {
  tenant_id: string;
  entity_id: string;
  entity_type: string;
  action_type: string;
  reason: string;
  severity: string;
  expires_at: string | null;
}

export interface AppealSubmittedPayload {
  tenant_id: string;
  enforcement_id: string;
  entity_id: string;
  entity_type: string;
  reason: string;
  submitted_by: string;
}

export interface AppealResolvedPayload {
  tenant_id: string;
  enforcement_id: string;
  entity_id: string;
  resolution: 'approved' | 'rejected';
  resolved_by: string;
  notes: string | null;
}

export interface PolicyVersionPublishedPayload {
  policy_id: string;
  version_number: number;
  title: string;
  requires_reacceptance: boolean;
  published_by: string;
}

export interface PolicyAcceptedPayload {
  policy_id: string;
  version_id: string;
  user_id: string;
  tenant_id: string;
  accepted_at: number;
}

// ════════════════════════════════════
// DOMAIN CATALOG (autodiscovery)
// ════════════════════════════════════

export const __DOMAIN_CATALOG = {
  domain: 'Policy Governance',
  color: 'hsl(340 65% 47%)',
  events: [
    { name: 'AccountBanned', description: 'Conta banida permanente ou temporariamente' },
    { name: 'AccountSuspended', description: 'Conta suspensa por violação ou enforcement' },
    { name: 'AppealSubmitted', description: 'Recurso/apelação submetido contra enforcement' },
    { name: 'AppealResolved', description: 'Recurso/apelação resolvido (aprovado ou rejeitado)' },
    { name: 'PolicyVersionPublished', description: 'Nova versão de política publicada' },
    { name: 'PolicyAccepted', description: 'Política aceita por usuário' },
  ],
};
