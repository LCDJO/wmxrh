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
 *    - Configuração da integração Traccar
 *    - Vinculação de dispositivos a colaboradores e veículos
 *    - Definição de parâmetros comportamentais
 *    - Cadastro de pontos de radar
 *    - Análise de trajetos e velocidade
 *    - Geração de infrações e alertas
 *    - Dashboards operacionais e analíticos
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
  traccarApi,
  triggerTraccarSync, getCachedDevices, linkDeviceToEmployee, getSyncHealth, testTraccarHealth,
  getLatestHealthChecks, getTenantHealthHistory, triggerHealthCheck,
  getActiveHealthAlerts, getTenantHealthAlerts, resolveHealthAlert, getTokenOwnersByTenant,
  normalizeTraccarEvent, computeIntegrityHashSync, computeIntegrityHashAsync,
  validateWebhookRequest, buildDispatchManifest,
  resolveTraccarModuleAccess, getTraccarModuleKeys, isFleetIntelligenceEnabled,
  publishTraccarEvent, publishBatchTraccarEvents,
} from './saas-core';

export type {
  TraccarDevice, TraccarPosition, TraccarEvent, TraccarGeofence, TraccarNotification,
  TraccarGroup, TraccarDriver, TraccarMaintenance, TraccarCommand,
  TraccarReportSummary, TraccarReportTrip, TraccarReportStop, TraccarServerInfo, TraccarStatistics,
  SyncResult, DeviceCacheEntry,
  TraccarCanonicalEvent, TraccarOsmAndPayload, TraccarWebhookPayload,
  TraccarWebhookValidation, TraccarDispatchResult,
  HealthCheckResult, CheckResult, HealthAlert, TraccarTokenOwner,
  TraccarModuleAccessResult, TraccarEventPublishPayload,
} from './saas-core';

// ══════════════════════════════════════════════════════════
// LAYER 2: Tenant Fleet Intelligence
// ══════════════════════════════════════════════════════════

export {
  // Configuração
  getTenantTraccarConfig, saveTenantTraccarConfig, deactivateTenantTraccar,
  // Dispositivos
  listDeviceMappings, linkDevice, unlinkDevice, getUnlinkedDevices, getDeviceByEmployee,
  // Parâmetros comportamentais
  getTenantBehavioralParams, toBehaviorConfig, getDefaultBehavioralParams,
  // Radares
  listRadarPoints, listActiveRadarPoints, createRadarPoint, updateRadarPoint,
  deactivateRadarPoint, deleteRadarPoint, importRadarPoints,
  // Análise de trajetos
  analyzeTrips, getDailyTrips, getEmployeeTrips,
  // Infrações e alertas
  generateInfractions, evaluateEmployeeEscalation, getFleetAlerts, getInfractionCountsByEmployee,
  // BTIE Engines
  buildTrips, attachViolationsToTrips, detectRadarViolations,
  analyzeBehavior, radarViolationsToBehavior,
  computeDriverRiskScore, computeBatchDriverScores, analyzeHotspots,
  // Behavior & compliance services
  getBehaviorEvents, getBehaviorSummary, recordBehaviorEvent, evaluateSpeedSeverity,
  getComplianceIncidents, getComplianceSummary, createComplianceIncident, reviewIncident,
  // Events
  registerTraccarEventHandlers,
} from './fleet-intelligence';

export type {
  // Config
  TenantTraccarConfigRow, SaveTenantTraccarConfigDTO,
  // Devices
  DeviceMapping, CreateDeviceMappingDTO, UpdateDeviceMappingDTO,
  // Params
  TenantBehavioralParams,
  // Radars
  RadarPointRow, CreateRadarDTO, UpdateRadarDTO,
  // Trip analysis
  TripAnalysisResult, TripAnalysisOptions,
  // Infractions
  FleetInfraction, FleetAlert, GenerateInfractionsResult,
  // Engine types
  PositionPoint, TripSummary, RadarPoint, RadarViolationEvent,
  BtieEvent, BehaviorEventKind, DriverRiskScore, TrafficHotspot, HotspotGrid,
  ScoreInput, BehaviorConfig,
  // Service types
  BehaviorEvent, BehaviorSummary, BehaviorEventType,
  ComplianceIncident, ComplianceSummary,
} from './fleet-intelligence';
