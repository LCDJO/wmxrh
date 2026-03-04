/**
 * Traccar Integration Module — Public API
 *
 * ══════════════════════════════════════════════════════════
 * DUAS CAMADAS ARQUITETURAIS:
 * ══════════════════════════════════════════════════════════
 *
 * 1) SaaS Integration Core (Platform)
 *    - Autenticação com servidores Traccar
 *    - Consumo das APIs /devices /positions /events
 *    - Sincronização de dispositivos
 *    - Normalização de eventos
 *    - Publicação em fila de eventos
 *    - Monitoramento de integração por tenant
 *    - Controle de módulos liberados por plano
 *
 * 2) Tenant Fleet Intelligence (Tenant)
 *    - Análise comportamental (BTIE engines)
 *    - Construção de viagens
 *    - Detecção de infrações em radares
 *    - Score de risco por motorista
 *    - Gestão de compliance de frota
 *    - Handlers de eventos cross-module
 */

// ── Manifest & Lifecycle ──
export { TRACCAR_MODULE_ID, TRACCAR_MODULE_LAYERS, TRACCAR_EVENTS, initTraccarModule } from './manifest';

// ── Gateway (sandbox-scoped data access) ──
export { createTraccarGateway } from './gateway';

// ── UI Components ──
export { TraccarModuleUI } from './ui';

// ══════════════════════════════════════════════════════════
// LAYER 1: SaaS Integration Core
// ══════════════════════════════════════════════════════════

export {
  // API Client (autenticação + consumo)
  traccarApi,
  // Sincronização
  triggerTraccarSync,
  getCachedDevices,
  linkDeviceToEmployee,
  getSyncHealth,
  testTraccarHealth,
  // Monitoramento
  getLatestHealthChecks,
  getTenantHealthHistory,
  triggerHealthCheck,
  getActiveHealthAlerts,
  getTenantHealthAlerts,
  resolveHealthAlert,
  getTokenOwnersByTenant,
  // Normalização
  normalizeTraccarEvent,
  computeIntegrityHashSync,
  computeIntegrityHashAsync,
  validateWebhookRequest,
  buildDispatchManifest,
  // Controle de módulos por plano
  resolveTraccarModuleAccess,
  getTraccarModuleKeys,
  isFleetIntelligenceEnabled,
  // Publicação de eventos
  publishTraccarEvent,
  publishBatchTraccarEvents,
} from './saas-core';

export type {
  // API Types
  TraccarDevice,
  TraccarPosition,
  TraccarEvent,
  TraccarGeofence,
  TraccarNotification,
  TraccarGroup,
  TraccarDriver,
  TraccarMaintenance,
  TraccarCommand,
  TraccarReportSummary,
  TraccarReportTrip,
  TraccarReportStop,
  TraccarServerInfo,
  TraccarStatistics,
  SyncResult,
  DeviceCacheEntry,
  // Normalização
  TraccarCanonicalEvent,
  TraccarOsmAndPayload,
  TraccarWebhookPayload,
  TraccarWebhookValidation,
  TraccarDispatchResult,
  // Monitoramento
  HealthCheckResult,
  CheckResult,
  HealthAlert,
  TraccarTokenOwner,
  // Module access
  TraccarModuleAccessResult,
  // Event publishing
  TraccarEventPublishPayload,
} from './saas-core';

// ══════════════════════════════════════════════════════════
// LAYER 2: Tenant Fleet Intelligence
// ══════════════════════════════════════════════════════════

export {
  // BTIE Engines
  buildTrips,
  attachViolationsToTrips,
  detectRadarViolations,
  analyzeBehavior,
  radarViolationsToBehavior,
  computeDriverRiskScore,
  computeBatchDriverScores,
  analyzeHotspots,
  // Behavior service
  getBehaviorEvents,
  getBehaviorSummary,
  recordBehaviorEvent,
  evaluateSpeedSeverity,
  // Compliance service
  getComplianceIncidents,
  getComplianceSummary,
  createComplianceIncident,
  reviewIncident,
  // Event handlers
  registerTraccarEventHandlers,
} from './fleet-intelligence';

export type {
  // Engine types
  PositionPoint,
  TripSummary,
  RadarPoint,
  RadarViolationEvent,
  BtieEvent,
  BehaviorEventKind,
  DriverRiskScore,
  TrafficHotspot,
  HotspotGrid,
  ScoreInput,
  BehaviorConfig,
  // Service types
  BehaviorEvent,
  BehaviorSummary,
  BehaviorEventType,
  ComplianceIncident,
  ComplianceSummary,
} from './fleet-intelligence';
