/**
 * Traccar Module Services — Public API
 */
export { traccarApi } from './traccar-api-client';
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
} from './traccar-api-client';

export {
  triggerTraccarSync,
  getCachedDevices,
  linkDeviceToEmployee,
  getSyncHealth,
  testTraccarHealth,
} from './traccar-sync.service';
export type { SyncResult, DeviceCacheEntry } from './traccar-sync.service';

export {
  getBehaviorEvents,
  getBehaviorSummary,
  recordBehaviorEvent,
  evaluateSpeedSeverity,
} from './behavior-engine.service';
export type { BehaviorEvent, BehaviorSummary, BehaviorEventType } from './behavior-engine.service';

export {
  getComplianceIncidents,
  getComplianceSummary,
  createComplianceIncident,
  reviewIncident,
} from './compliance.service';
export type { ComplianceIncident, ComplianceSummary } from './compliance.service';
