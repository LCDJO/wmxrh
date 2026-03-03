/**
 * Navigation Governance Engine — Domain Events
 */

export const NAVIGATION_GOVERNANCE_EVENTS = {
  NavigationRefactorProposed: 'navigation_governance:refactor_proposed',
  NavigationVersionCreated: 'navigation_governance:version_created',
  NavigationRefactorApplied: 'navigation_governance:refactor_applied',
  NavigationRollbackExecuted: 'navigation_governance:rollback_executed',
} as const;

export type NavigationGovernanceEvent =
  typeof NAVIGATION_GOVERNANCE_EVENTS[keyof typeof NAVIGATION_GOVERNANCE_EVENTS];

export interface NavigationRefactorProposedPayload {
  refactor_id: string;
  proposed_by: string;
  scope: 'platform' | 'tenant' | 'both';
  affected_routes: string[];
  reason: string;
}

export interface NavigationVersionCreatedPayload {
  version_id: string;
  version_number: number;
  snapshot_hash: string;
  created_by: string;
}

export interface NavigationRefactorAppliedPayload {
  refactor_id: string;
  version_id: string;
  applied_by: string;
  routes_added: number;
  routes_removed: number;
  routes_moved: number;
}

export interface NavigationRollbackExecutedPayload {
  rollback_id: string;
  from_version: number;
  to_version: number;
  rolled_back_by: string;
  reason: string;
}

export const __DOMAIN_CATALOG = {
  domain: 'Navigation Governance',
  color: 'hsl(160 50% 45%)',
  events: [
    { name: 'NavigationRefactorProposed', description: 'Proposta de refatoração de navegação criada' },
    { name: 'NavigationVersionCreated', description: 'Nova versão de navegação registrada' },
    { name: 'NavigationRefactorApplied', description: 'Refatoração de navegação aplicada' },
    { name: 'NavigationRollbackExecuted', description: 'Rollback de navegação executado' },
  ],
};
