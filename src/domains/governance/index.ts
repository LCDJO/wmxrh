// ── GovernanceCoreEngine (event-sourced backbone) ──
export { GovernanceCoreEngine, getGovernanceCoreEngine } from './api/governance-core-engine';
export type { GovernanceCoreEngineAPI } from './api/governance-core-engine';
export { GovernanceCommandHandler } from './services/governance-command-handler';
export type { GovernanceCommand } from './services/governance-command-handler';
export { GovernanceQueryService } from './services/governance-query-service';
export { GovernanceEventStore } from './repositories/governance-event-store';
export { GovernanceProjectionStore } from './repositories/governance-projection-store';
export type { ProjectionRecord } from './repositories/governance-projection-store';
export { GovernanceAggregate } from './entities/governance-aggregate';
export { EmployeeLegalTimelineAggregate } from './entities/employee-legal-timeline-aggregate';
export type {
  LegalEvent, LegalEventCategory, LegalEventSeverity,
  Policy, PolicyScope, PolicyStatus,
  PolicyVersion,
  SanctionRecord, SanctionType, SanctionStatus,
  RiskAssessment, RiskCategory, RiskFactor,
  AdministrativeDecision, DecisionType, DecisionStatus,
  EmployeeLegalTimeline, EmployeeLegalTimelineEntry, TimelineEntryType,
} from './entities/governance-entities';
export { createGovernanceEvent, type GovernanceDomainEvent, type GovernanceEventMetadata } from './events/governance-domain-event';
export { DISCIPLINARY_EVENTS, type DisciplinaryEventType } from './events/disciplinary-events';
export type { AdvertenciaPayload, SuspensaoPayload, AfastamentoPayload, DesligamentoPayload } from './events/disciplinary-events';
export { onGovernanceEvent, onAnyGovernanceEvent, dispatchGovernanceEvents } from './events/governance-event-bus';
export { registerProjector, initCoreProjectors } from './projections/governance-projector';
export { DisciplinaryService } from './services/disciplinary-service';
export { SanctionEngine, getSanctionEngine } from './services/sanction-engine';
export { SANCTION_EVENTS, type SanctionEventType, type SanctionAccountStatus } from './events/sanction-events';
export type { SanctionCreatedPayload, SanctionStatusChangePayload, SanctionEscalatedPayload, SanctionContestedPayload, SanctionRevokedPayload } from './events/sanction-events';
export { PolicyEngine, getPolicyEngine } from './services/policy-engine';
export { POLICY_EVENTS, type PolicyEventType } from './events/policy-events';
export type { AcceptanceRecordedPayload, VersionPublishedPayload, AcceptanceInvalidatedPayload } from './events/policy-events';
export { EMPLOYEE_LIFECYCLE_EVENTS, type EmployeeLifecycleEventType } from './events/employee-lifecycle-events';
export type { EmployeeHiredPayload, EmployeeWarnedPayload, EmployeeSuspendedPayload, EmployeeTerminatedPayload, PerformanceReviewPayload, EmployeePromotedPayload } from './events/employee-lifecycle-events';
export { initOrganizationalIntelligenceEngine, OrganizationalIntelligenceQuery, getOrganizationalIntelligence } from './services/organizational-intelligence-engine';
export { OrgIntelligenceJobDispatcher, OrgIntelligenceSnapshotQuery, ORG_INTELLIGENCE_JOB_TYPES, type OrgIntelligenceJobType } from './services/organizational-intelligence-engine';

// ── Legacy services (read-only analytics) ──
export { captureAuditSnapshot, fetchAuditSnapshots, compareSnapshots } from './visual-audit.service';
export { evaluateCompliance, fetchComplianceRules, seedBuiltInRules, BUILT_IN_RULES } from './compliance-engine.service';
export { captureRiskTrendSnapshot, fetchTrendHistory, analyzeTrends, requestAIForecast } from './predictive-risk.service';
export type * from './governance.types';
