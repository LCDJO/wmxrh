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

// ── Legal Source Adapters ──
export {
  createNrAdapter,
  createCltAdapter,
  createEsocialAdapter,
  createCnaeAdapter,
  createCboAdapter,
  createCctAdapter,
  createAllAdapters,
} from './adapters';

export type {
  LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck,
  SyncOptions, SyncResult, LegalSourceId,
  NrRecord, CltArticle, CltTema,
  EsocialEvent, EsocialEventGroup,
  CnaeRecord, CboRecord,
  CctRecord, CctClausulaDestaque,
} from './adapters';

// ── Legal Crawler Service ──
export {
  normalizeText,
  generateContentHash,
  extractSections,
  diffDocuments,
  crawlDocument,
  runCrawl,
  createInMemoryVersionStore,
} from './legal-crawler.service';

export type {
  CrawledDocument,
  VersionedDocument,
  CrawlDiffResult,
  CrawlRunResult,
  CrawlError,
  DocumentVersionStore,
} from './legal-crawler.service';

// ── Legal Diff Engine ──
export { computeLegalDiff } from './legal-diff.engine';

export type {
  TipoMudanca,
  GravidadeMudanca,
  AreaImpacto,
  LegalArticleDiff,
  LegalChangeSummary,
  ImpactoEstimado,
  AcaoRecomendada,
} from './legal-diff.engine';

// ── Legal Versioning Manager ──
export { legalVersioningService } from './legal-versioning.service';

export type {
  LegalDocumentTipo,
  LegalDocumentRecord,
  CreateLegalDocumentDTO,
  VersionComparisonResult,
} from './legal-versioning.service';

// ── Legal Impact Analyzer ──
export { analyzeLegalImpact } from './legal-impact-analyzer.engine';

export type {
  CargoSnapshot,
  EmpresaSnapshot,
  TreinamentoNrSnapshot,
  EpiCatalogSnapshot,
  LegalImpactInput,
  AffectedCargo,
  AffectedEmpresa,
  AffectedTreinamento,
  AffectedEpi,
  LegalImpactNotification,
  NotificationPriority,
  NotificationChannel,
} from './legal-impact-analyzer.engine';

// ── Legal Automated Actions ──
export { generateAutomatedActions } from './legal-automated-actions.engine';

export type {
  AutomatedActionType,
  ActionStatus,
  AutomatedActionBase,
  CreateSafetyWorkflowAction,
  RequireTrainingAction,
  UpdateSalaryFloorAction,
  RecalculatePayrollAction,
  UpdateEpiRequirementsAction,
  UpdateHealthProgramAction,
  AutomatedAction,
  AutomatedActionsResult,
} from './legal-automated-actions.engine';
