/**
 * ══════════════════════════════════════════════════════════
 * TWO-LAYER ARCHITECTURE — Public API
 * ══════════════════════════════════════════════════════════
 *
 *  Layer 1: PLATFORM (SaaS Core)  — global, stateless for client data
 *  Layer 2: TENANT   (Client)     — tenant-scoped, RLS-protected
 */

// ── Platform Layer ──
export {
  PLATFORM_DOMAINS,
  PLATFORM_CAPABILITIES,
  isPlatformDomain,
  emitPlatformLayerEvent,
  onPlatformLayerEvent,
} from './platform/platform-layer.registry';
export type {
  PlatformDomainKey,
  PlatformCapability,
  PlatformLayerEvent,
} from './platform/platform-layer.registry';

// ── Platform: Traccar Integration Core ──
export {
  normalizeTraccarEvent,
  computeIntegrityHashSync,
  computeIntegrityHashAsync,
  validateWebhookRequest,
  buildDispatchManifest,
} from './platform/traccar-integration.core';
export type {
  TraccarCanonicalEvent,
  TraccarOsmAndPayload,
  TraccarWebhookPayload,
  TraccarWebhookValidation,
  TraccarDispatchResult,
} from './platform/traccar-integration.core';

// ── Tenant: Traccar Config & Policies ──
export {
  evaluateDisciplinaryAction,
  isWithinEnforcementZone,
} from './tenant/traccar-config.types';
export type {
  TenantTraccarConfig,
  TraccarProtocol,
  CreateTenantTraccarConfigDTO,
  TenantDeviceMapping,
  CreateDeviceMappingDTO,
  TenantSpeedLimitPolicy,
  CreateSpeedLimitPolicyDTO,
  TenantEnforcementPoint,
  EnforcementType,
  EnforcementSource,
  CreateEnforcementPointDTO,
  TenantDisciplinaryPolicy,
  DisciplinaryEscalationStep,
  DisciplinaryAction,
  CreateDisciplinaryPolicyDTO,
  DisciplinaryEvaluation,
} from './tenant/traccar-config.types';

// ── Tenant Layer ──
export {
  TENANT_DOMAINS,
  TENANT_CAPABILITIES,
  isTenantDomain,
  emitTenantLayerEvent,
  onTenantLayerEvent,
  assertTenantIsolation,
  TenantIsolationError,
  getCapabilitiesByCategory,
  getTenantDomainCategory,
} from './tenant/tenant-layer.registry';
export type {
  TenantDomainKey,
  TenantCapability,
  TenantCapabilityCategory,
  TenantLayerEvent,
} from './tenant/tenant-layer.registry';

// ── Platform: Parametrization ──
export {
  getEngineRegistry,
  isEngineEnabled,
  setEngineState,
  getLegislativeConfig,
  updateLegislativeConfig,
  getPlatformFlags,
  isPlatformFlagEnabled,
  setPlatformFlag,
} from './platform/platform-parametrization';
export type {
  PlatformEngineKey,
  PlatformEngineConfig,
  LegislativeAlertType,
  LegislativeUpdateConfig,
  LegislativeSource,
  LegislativeAlertRouting,
  PlatformFeatureFlag,
} from './platform/platform-parametrization';

// ── Tenant: Parametrization ──
export {
  isWithinWorkSchedule,
  getDefaultBehavioralScoreConfig,
} from './tenant/tenant-parametrization';
export type {
  TenantOperationalRules,
  CreateOperationalRulesDTO,
  TenantSpeedConfig,
  SpeedZone,
  TenantWarningPolicy,
  WarningEscalationStep,
  TenantWorkSchedule,
  DailySchedule,
  TenantBehavioralScoreConfig,
  CreateBehavioralScoreConfigDTO,
} from './tenant/tenant-parametrization';

// ── Layer Boundary Engine ──
export {
  evaluateLayerAccess,
  assertLayerAccess,
  classifyDomain,
  getDomainLayer,
  LayerBoundaryViolation,
} from './layer-boundary.engine';
export type {
  LayerAccessDirection,
  AccessMode,
  LayerAccessRequest,
  LayerAccessDecision,
} from './layer-boundary.engine';
