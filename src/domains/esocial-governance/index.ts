/**
 * eSocial Governance & Monitoring Center — Bounded Context
 *
 * Centralizes eSocial integration governance at SuperAdmin level
 * and provides tenant/company-level monitoring.
 *
 * Integrations:
 *  - Government Integration Gateway
 *  - eSocial Integration Engine
 *  - Regulatory Intelligence Engine
 *  - Legal AI Interpretation Engine
 *  - Security Kernel
 *  - Access Graph
 */

export {
  getSystemStatus,
  getGovernanceConfig,
  getLayoutVersions,
  getCurrentLayout,
  getUpcomingLayoutChange,
  getPlatformKPIs,
  getTenantOverviews,
  getActiveAlerts,
  generateAlert,
} from './esocial-monitoring.engine';

export {
  esocialGovernanceEvents,
  emitEsocialGovEvent,
  onEsocialGovEvent,
} from './esocial-governance.events';

export type {
  EsocialLayoutVersion,
  EsocialEventGroup,
  EsocialLayoutInfo,
  EsocialTenantStatus,
  EsocialEventStatus,
  EsocialTenantOverview,
  EsocialCompanyStatus,
  EsocialEventSummary,
  EsocialPendency,
  EsocialAlertType,
  EsocialAlert,
  EsocialPlatformKPIs,
  EsocialGovernanceConfig,
  EsocialWebserviceStatus,
  EsocialSystemStatus,
} from './types';
