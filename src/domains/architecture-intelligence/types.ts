/**
 * Architecture Intelligence Engine — Types
 *
 * PlatformModule model (canonical):
 *   module_id, module_name, domain, description, status, version,
 *   dependencies[], emits_events[], consumes_events[], monitoring_metrics[],
 *   expected_deliverables[], owner, last_updated
 */
import type { ModuleDependency, SemanticVersion } from '@/domains/platform-versioning/types';

// ── Module Status ──

export type ModuleLifecycleStatus = 'planning' | 'development' | 'stable' | 'deprecated';

// ── Monitoring Metric ──

export interface ModuleMonitoringMetric {
  metric_name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
}

// ── Module Info (canonical PlatformModule model) ──

export interface ArchModuleInfo {
  /** module_id */
  key: string;
  /** module_name */
  label: string;
  /** domain: saas | tenant */
  domain: 'saas' | 'tenant';
  description: string;
  /** planning | development | stable | deprecated */
  lifecycle_status: ModuleLifecycleStatus;
  version: SemanticVersion;
  version_tag: string;
  dependencies: ModuleDependency[];
  emits_events: ArchEventMapping[];
  consumes_events: ArchEventMapping[];
  monitoring_metrics: ModuleMonitoringMetric[];
  expected_deliverables: ArchDeliverable[];
  docs: ArchDocEntry[];
  owner: string;
  last_updated: string;
  changelog_summary: string;

  // ── Compat aliases (used by UI) ──
  /** @deprecated use domain */
  category: 'platform' | 'domain';
  /** @deprecated use lifecycle_status */
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  /** @deprecated use emits_events */
  events: ArchEventMapping[];
  /** @deprecated use expected_deliverables */
  deliverables: ArchDeliverable[];
}

// ── Event Mapping ──

export interface ArchEventMapping {
  event_name: string;
  domain: string;
  description: string;
  payload_type?: string;
}

// ── Deliverables ──

export type DeliverableStatus = 'done' | 'in_progress' | 'planned' | 'blocked';

export interface ArchDeliverable {
  id: string;
  title: string;
  status: DeliverableStatus;
  module_key: string;
  description?: string;
  completed_at?: string;
}

// ── Documentation ──

export interface ArchDocEntry {
  id: string;
  title: string;
  module_key: string;
  content_md: string;
  updated_at: string;
  author?: string;
}

// ── Architecture Version ──

export interface ArchVersionEntry {
  version_tag: string;
  date: string;
  structural_changes: string[];
  impacted_modules: string[];
}

// ── Dependency Edge (for graph) ──

export interface DependencyEdge {
  from: string;
  to: string;
  is_mandatory: boolean;
  note?: string;
}

// ── Engine API ──

export interface ArchitectureIntelligenceEngineAPI {
  getModules(): ArchModuleInfo[];
  getModule(key: string): ArchModuleInfo | null;
  getDependencyEdges(): DependencyEdge[];
  getEventMap(): ArchEventMapping[];
  getDeliverables(): ArchDeliverable[];
  getDocs(): ArchDocEntry[];
  getVersionHistory(): ArchVersionEntry[];
}
