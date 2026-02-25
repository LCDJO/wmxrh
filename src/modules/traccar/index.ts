/**
 * Traccar Integration Module — Public API
 *
 * Platform (SaaS): global server config, ingest engine, event normalizer
 * Tenant (Client): device mapping, speed policies, compliance, behavior
 */

// Manifest & lifecycle
export { TRACCAR_MODULE_ID, TRACCAR_MODULE_LAYERS, TRACCAR_EVENTS, initTraccarModule } from './manifest';

// Gateway (sandbox-scoped data access)
export { createTraccarGateway } from './gateway';

// UI components
export { TraccarModuleUI } from './ui';

// Event handlers
export { registerTraccarEventHandlers } from './events';

// Services (API client, sync, behavior, compliance)
export {
  traccarApi,
  triggerTraccarSync,
  getCachedDevices,
  linkDeviceToEmployee,
  getSyncHealth,
  testTraccarHealth,
  getBehaviorEvents,
  getBehaviorSummary,
  recordBehaviorEvent,
  evaluateSpeedSeverity,
  getComplianceIncidents,
  getComplianceSummary,
  createComplianceIncident,
  reviewIncident,
} from './services';

// BTIE Engines (pure logic)
export {
  buildTrips,
  attachViolationsToTrips,
  detectRadarViolations,
  analyzeBehavior,
  radarViolationsToBehavior,
  computeDriverRiskScore,
  computeBatchDriverScores,
  analyzeHotspots,
} from './engines';

export type {
  PositionPoint,
  TripSummary,
  RadarPoint,
  RadarViolationEvent,
  BehaviorEvent as BtieEvent,
  BehaviorEventKind,
  DriverRiskScore,
  TrafficHotspot,
  HotspotGrid,
  ScoreInput,
  BehaviorConfig,
} from './engines';

export type {
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
  BehaviorEvent,
  BehaviorSummary,
  BehaviorEventType,
  ComplianceIncident,
  ComplianceSummary,
} from './services';
