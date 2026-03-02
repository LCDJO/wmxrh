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

// ── Legacy services (read-only analytics) ──
export { captureAuditSnapshot, fetchAuditSnapshots, compareSnapshots } from './visual-audit.service';
export { evaluateCompliance, fetchComplianceRules, seedBuiltInRules, BUILT_IN_RULES } from './compliance-engine.service';
export { captureRiskTrendSnapshot, fetchTrendHistory, analyzeTrends, requestAIForecast } from './predictive-risk.service';
export type * from './governance.types';
