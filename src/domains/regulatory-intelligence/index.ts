/**
 * Regulatory Intelligence Engine — Bounded Context
 *
 * Monitors, versions, and auto-updates the legal base (NR, CLT, CCT, Portarias).
 *
 * Integrations:
 *  - Career & Legal Intelligence Engine
 *  - Occupational Intelligence Engine
 *  - Labor Rules Engine
 *  - PCMSO / PGR
 *  - NR Training Lifecycle Engine
 *  - Government Integration Gateway
 *  - Workforce Intelligence Engine
 *  - Safety Automation Engine
 *  - Security Kernel
 *
 * Capabilities:
 *  - Monitor legislative changes automatically
 *  - Version norms and portarias
 *  - Identify impact on positions and companies
 *  - Generate automatic alerts
 *  - Update internal legal base
 */

// ── Engines (pure, no I/O) ──
export { checkForChanges, getKnownNrCatalog } from './regulatory-monitor.engine';
export { analyzeImpact } from './regulatory-impact.engine';
export { generateAlerts } from './regulatory-alert.engine';
export { computeLegalBaseUpdates } from './regulatory-legal-base.engine';

// ── Events ──
export { regulatoryEvents, emitRegulatoryEvent, onRegulatoryEvent } from './regulatory-intelligence.events';

// ── Types ──
export type {
  NormaTipo,
  NormaStatus,
  MonitorFrequency,
  ImpactSeverity,
  ImpactArea,
  AlertStatus,
  UpdateSourceType,
  RegulatoryNorm,
  NormVersion,
  RegulatoryMonitorConfig,
  RegulatoryImpact,
  AffectedEntity,
  RegulatoryAlert,
  LegalBaseUpdate,
  CreateRegulatoryNormDTO,
  CreateNormVersionDTO,
  CreateRegulatoryAlertDTO,
  MonitorCheckInput,
  ImpactAnalysisInput,
  LegalBaseRefreshInput,
} from './types';

export type { MonitorCheckResult, DetectedNormChange } from './regulatory-monitor.engine';
export type { ImpactAnalysisResult, ImpactSummary } from './regulatory-impact.engine';
export type { AlertGenerationResult } from './regulatory-alert.engine';
export type { LegalBaseRefreshResult } from './regulatory-legal-base.engine';
