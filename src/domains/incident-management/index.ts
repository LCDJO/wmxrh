/**
 * Enterprise Incident Management System — Barrel Export
 *
 * Architecture:
 *   IncidentManagementEngine
 *    ├── IncidentDetector          → auto-detection from observability signals
 *    ├── SeverityClassifier        → severity classification & reclassification
 *    ├── SLAEngine                 → SLA configuration, deadlines, breach checks
 *    ├── EscalationManager         → auto-escalation with time-based rules
 *    ├── ClientNotificationService → multi-channel incident notifications
 *    ├── StatusPageService         → public status page management
 *    ├── PostmortemManager         → post-incident review lifecycle
 *    └── AvailabilityReporter      → uptime calculation & SLA reporting
 *
 * Integrations:
 *    - ObservabilityCore  → health/error/latency signals → IncidentDetector
 *    - SelfHealingEngine  → failed recovery → auto-create critical incident
 *    - Control Plane      → dashboard stats, management UI
 *    - GovernanceAI       → postmortem analysis, root cause suggestions
 */

export {
  createIncidentManagementEngine,
  getIncidentManagementEngine,
  resetIncidentManagementEngine,
} from './incident-management-engine';

export { INCIDENT_KERNEL_EVENTS } from './incident-events';
export { installSelfHealingIncidentBridge } from './self-healing-incident-bridge';
export type {
  IncidentKernelEvent,
  IncidentCreatedPayload,
  IncidentStatusChangedPayload,
  IncidentEscalatedPayload,
  SLABreachedPayload,
  PostmortemPublishedPayload,
} from './incident-events';

export type {
  IncidentSeverity,
  IncidentStatus,
  EscalationLevel,
  NotificationChannel,
  ComponentStatus,
  Incident,
  IncidentUpdate,
  SLAConfig,
  EscalationRecord,
  IncidentNotification,
  StatusPageComponent,
  StatusPageIncident,
  Postmortem,
  AvailabilityRecord,
  CreateIncidentInput,
  DetectionSignal,
  IncidentDetectorAPI,
  SeverityClassifierAPI,
  SLAEngineAPI,
  EscalationManagerAPI,
  ClientNotificationServiceAPI,
  StatusPageServiceAPI,
  PostmortemManagerAPI,
  AvailabilityReporterAPI,
  IncidentManagementEngineAPI,
  IncidentDashboardStats,
  RemediationSuggestion,
  RemediationAction,
} from './types';
