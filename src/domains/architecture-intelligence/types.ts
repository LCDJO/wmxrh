/**
 * Architecture Intelligence Engine — Types
 */
import type { ModuleDependency, SemanticVersion } from '@/domains/platform-versioning/types';

// ── Module Info ──

export interface ArchModuleInfo {
  key: string;
  label: string;
  description: string;
  category: 'platform' | 'domain';
  version: SemanticVersion;
  version_tag: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  dependencies: ModuleDependency[];
  events: ArchEventMapping[];
  deliverables: ArchDeliverable[];
  docs: ArchDocEntry[];
  changelog_summary: string;
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
