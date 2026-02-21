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
