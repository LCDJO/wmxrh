/**
 * Architecture Risk Analyzer — Barrel Export
 */
export {
  createArchitectureRiskAnalyzer,
  type ArchitectureRiskAnalyzerAPI,
  type ModuleRiskProfile,
  type RiskFactor,
  type RefactorSuggestion,
  type CircularDependencyCycle,
  type CouplingMetrics,
  type PlatformRiskSummary,
  type RiskLevel,
  type DependencyRiskScore,
  type BidirectionalDependency,
  type CrossDomainViolation,
  type CriticalityIndex,
  type ChangeImpactPrediction,
  type ImpactedModule,
  type AffectedTenant,
  type AffectedWorkflow,
  type PreflightCheck,
} from './engine';

export {
  onArchitectureRiskEvent,
  onArchitectureRiskEventType,
  emitArchitectureRiskEvent,
  getArchitectureRiskEventLog,
  clearArchitectureRiskEventLog,
  type ArchitectureRiskEventType,
  type ArchitectureRiskDomainEvent,
  type ArchitectureRiskCalculatedPayload,
  type CriticalDependencyDetectedPayload,
  type CircularDependencyBlockedPayload,
  type RefactorSuggestionGeneratedPayload,
} from './architecture-risk.events';
