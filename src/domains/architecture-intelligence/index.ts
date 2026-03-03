/**
 * Architecture Intelligence — Barrel Export
 */
export { createArchitectureIntelligenceEngine } from './engine';
export {
  architectureIntelligenceEvents,
  emitArchitectureEvent,
  onArchitectureEvent,
} from './architecture-intelligence.events';
export type {
  ArchitectureIntelligenceEngineAPI,
  ArchModuleInfo,
  ArchEventMapping,
  ArchDeliverable,
  ArchDocEntry,
  ArchVersionEntry,
  DependencyEdge,
  DeliverableStatus,
  ModuleLifecycleStatus,
  ModuleMonitoringMetric,
  ModuleSLA,
} from './types';
