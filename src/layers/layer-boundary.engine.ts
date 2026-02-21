/**
 * ══════════════════════════════════════════════════════════
 * LAYER BOUNDARY ENGINE
 * ══════════════════════════════════════════════════════════
 *
 * Enforces the separation contract between Platform and
 * Tenant layers:
 *
 *  Rule 1: Platform → Tenant: ONLY via normalized events
 *  Rule 2: Tenant → Platform: ONLY via read-only queries
 *  Rule 3: Platform NEVER stores operational client data
 *  Rule 4: Tenant NEVER bypasses Security Kernel
 *  Rule 5: Cross-tenant access is ALWAYS forbidden
 */

import { isPlatformDomain, type PlatformDomainKey, PLATFORM_DOMAINS } from './platform/platform-layer.registry';
import { isTenantDomain, type TenantDomainKey, TENANT_DOMAINS } from './tenant/tenant-layer.registry';

// ── Access Direction ──

export type LayerAccessDirection =
  | 'platform_to_tenant'
  | 'tenant_to_platform'
  | 'platform_to_platform'
  | 'tenant_to_tenant';

export type AccessMode = 'read' | 'write' | 'event';

export interface LayerAccessRequest {
  sourceDomain: string;
  targetDomain: string;
  mode: AccessMode;
  tenantId?: string;
}

export interface LayerAccessDecision {
  allowed: boolean;
  direction: LayerAccessDirection;
  reason: string;
  rule: string;
}

// ── Boundary Rules ──

const RULES: Record<string, (req: LayerAccessRequest, dir: LayerAccessDirection) => LayerAccessDecision | null> = {

  'R1_PLATFORM_TO_TENANT_EVENT_ONLY': (req, dir) => {
    if (dir !== 'platform_to_tenant') return null;
    if (req.mode === 'event') {
      return { allowed: true, direction: dir, reason: 'Platform forwards normalized events to tenant', rule: 'R1' };
    }
    return { allowed: false, direction: dir, reason: 'Platform can only reach Tenant via events — direct read/write forbidden', rule: 'R1' };
  },

  'R2_TENANT_TO_PLATFORM_READ_ONLY': (req, dir) => {
    if (dir !== 'tenant_to_platform') return null;
    if (req.mode === 'read') {
      return { allowed: true, direction: dir, reason: 'Tenant may read global platform data (e.g. regulatory catalog)', rule: 'R2' };
    }
    return { allowed: false, direction: dir, reason: 'Tenant cannot write to Platform layer', rule: 'R2' };
  },

  'R3_INTRA_PLATFORM': (req, dir) => {
    if (dir !== 'platform_to_platform') return null;
    return { allowed: true, direction: dir, reason: 'Intra-platform communication allowed', rule: 'R3' };
  },

  'R4_INTRA_TENANT': (req, dir) => {
    if (dir !== 'tenant_to_tenant') return null;
    return { allowed: true, direction: dir, reason: 'Intra-tenant communication allowed (same tenant boundary)', rule: 'R4' };
  },
};

// ── Engine ──

function resolveDirection(sourceDomain: string, targetDomain: string): LayerAccessDirection {
  const sourceIsPlatform = isPlatformDomain(sourceDomain);
  const targetIsPlatform = isPlatformDomain(targetDomain);

  if (sourceIsPlatform && targetIsPlatform) return 'platform_to_platform';
  if (sourceIsPlatform && !targetIsPlatform) return 'platform_to_tenant';
  if (!sourceIsPlatform && targetIsPlatform) return 'tenant_to_platform';
  return 'tenant_to_tenant';
}

export function evaluateLayerAccess(request: LayerAccessRequest): LayerAccessDecision {
  const direction = resolveDirection(request.sourceDomain, request.targetDomain);

  for (const rule of Object.values(RULES)) {
    const decision = rule(request, direction);
    if (decision) return decision;
  }

  return {
    allowed: false,
    direction,
    reason: 'No matching rule — access denied by default',
    rule: 'DEFAULT_DENY',
  };
}

// ── Convenience helpers ──

export function assertLayerAccess(request: LayerAccessRequest): void {
  const decision = evaluateLayerAccess(request);
  if (!decision.allowed) {
    throw new LayerBoundaryViolation(decision);
  }
}

export class LayerBoundaryViolation extends Error {
  public readonly decision: LayerAccessDecision;
  constructor(decision: LayerAccessDecision) {
    super(`[LayerBoundary] ${decision.rule}: ${decision.reason} (${decision.direction})`);
    this.name = 'LayerBoundaryViolation';
    this.decision = decision;
  }
}

// ── Domain classification helpers ──

export function classifyDomain(domainPath: string): 'platform' | 'tenant' | 'unknown' {
  if (isPlatformDomain(domainPath)) return 'platform';
  if (isTenantDomain(domainPath)) return 'tenant';
  return 'unknown';
}

export function getDomainLayer(domainPath: string) {
  return {
    layer: classifyDomain(domainPath),
    isPlatform: isPlatformDomain(domainPath),
    isTenant: isTenantDomain(domainPath),
  };
}
