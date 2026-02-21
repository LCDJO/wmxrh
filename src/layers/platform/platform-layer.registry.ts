/**
 * ══════════════════════════════════════════════════════════
 * PLATFORM LAYER (SaaS Core) — Registry & Manifest
 * ══════════════════════════════════════════════════════════
 *
 * The Platform Layer is the GLOBAL infrastructure that runs
 * independently of any specific tenant. It:
 *
 *  ✅ Manages the Security Kernel
 *  ✅ Runs the Regulatory Intelligence Engine
 *  ✅ Runs the Legal AI Interpretation Engine
 *  ✅ Manages the Government Integration Gateway
 *  ✅ Manages the Traccar Integration Core
 *  ✅ Controls Feature Flags
 *  ✅ Handles system versioning
 *  ✅ Performs global auditing
 *
 *  ❌ Does NOT store operational client data
 *  ❌ Only normalizes and forwards events
 *  ❌ Never exposes raw tenant data upstream
 */

// ── Domain mappings ──

export const PLATFORM_DOMAINS = {
  SECURITY_KERNEL:              'security',
  REGULATORY_INTELLIGENCE:      'regulatory-intelligence',
  LEGAL_AI_INTERPRETATION:      'legal-ai-interpretation',
  GOVERNMENT_INTEGRATION:       'esocial-engine',
  TRACCAR_INTEGRATION_CORE:     'fleet-compliance',
  FEATURE_FLAGS:                'security',          // feature-flags lives inside security kernel
  SYSTEM_VERSIONING:            'platform-versioning',
  GLOBAL_AUDIT:                 'audit',
  PLATFORM_OS:                  'platform-os',
  PLATFORM_IAM:                 'iam',
  PLATFORM_COGNITIVE:           'platform-cognitive',
  PLATFORM_EXPERIENCE:          'platform-experience',
  PLATFORM_GROWTH:              'platform-growth',
  OBSERVABILITY:                'observability',
  SELF_HEALING:                 'self-healing',
  CONTROL_PLANE:                'control-plane',
  REVENUE_INTELLIGENCE:         'revenue-intelligence',
  BILLING_CORE:                 'billing-core',
} as const;

export type PlatformDomainKey = keyof typeof PLATFORM_DOMAINS;

// ── Capabilities ──

export interface PlatformCapability {
  key: PlatformDomainKey;
  domain: string;
  description: string;
  storesClientData: false;     // Platform NEVER stores operational client data
  scope: 'global';
}

export const PLATFORM_CAPABILITIES: PlatformCapability[] = [
  {
    key: 'SECURITY_KERNEL',
    domain: PLATFORM_DOMAINS.SECURITY_KERNEL,
    description: 'Central 7-layer security pipeline with RBAC+ABAC, Access Graph and Identity Intelligence',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'REGULATORY_INTELLIGENCE',
    domain: PLATFORM_DOMAINS.REGULATORY_INTELLIGENCE,
    description: 'Monitors NRs, CLT, CCTs with structural diffing, FNV-1a hashing and immutable history',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'LEGAL_AI_INTERPRETATION',
    domain: PLATFORM_DOMAINS.LEGAL_AI_INTERPRETATION,
    description: 'Transforms legislative changes into dual-layer executive summaries (technical + PME)',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'GOVERNMENT_INTEGRATION',
    domain: PLATFORM_DOMAINS.GOVERNMENT_INTEGRATION,
    description: 'Gateway to eSocial, DETRAN and government APIs — normalizes and forwards events',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'TRACCAR_INTEGRATION_CORE',
    domain: PLATFORM_DOMAINS.TRACCAR_INTEGRATION_CORE,
    description: 'Traccar ingest core — receives, validates and hashes raw tracking events before tenant dispatch',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'FEATURE_FLAGS',
    domain: PLATFORM_DOMAINS.FEATURE_FLAGS,
    description: 'Global feature flag engine controlling gradual rollouts and tenant-level toggles',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'SYSTEM_VERSIONING',
    domain: PLATFORM_DOMAINS.SYSTEM_VERSIONING,
    description: 'SemVer-based system versioning with publish/rollback governance',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'GLOBAL_AUDIT',
    domain: PLATFORM_DOMAINS.GLOBAL_AUDIT,
    description: 'Append-only immutable audit log for platform-wide events',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'PLATFORM_OS',
    domain: PLATFORM_DOMAINS.PLATFORM_OS,
    description: 'Platform operating system layer — module federation, sandbox, lifecycle',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'PLATFORM_IAM',
    domain: PLATFORM_DOMAINS.PLATFORM_IAM,
    description: 'Platform-level identity and access management',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'OBSERVABILITY',
    domain: PLATFORM_DOMAINS.OBSERVABILITY,
    description: 'System-wide observability, metrics, tracing and alerting',
    storesClientData: false,
    scope: 'global',
  },
  {
    key: 'BILLING_CORE',
    domain: PLATFORM_DOMAINS.BILLING_CORE,
    description: 'SaaS billing engine — plans, invoices, coupons, revenue metering',
    storesClientData: false,
    scope: 'global',
  },
];

// ── Platform Event Bus ──

export type PlatformLayerEvent =
  | { type: 'REGULATORY_UPDATE_DETECTED';   payload: { documentId: string; hash: string } }
  | { type: 'LEGAL_INTERPRETATION_READY';   payload: { interpretationId: string; tenantIds: string[] } }
  | { type: 'GOVERNMENT_EVENT_NORMALIZED';  payload: { source: string; eventId: string } }
  | { type: 'TRACKING_EVENT_INGESTED';      payload: { eventId: string; integrityHash: string } }
  | { type: 'FEATURE_FLAG_CHANGED';         payload: { flagKey: string; enabled: boolean } }
  | { type: 'SYSTEM_VERSION_PUBLISHED';     payload: { version: string; moduleKey: string } }
  | { type: 'AUDIT_ENTRY_CREATED';          payload: { entryId: string; action: string } };

type PlatformLayerEventHandler = (event: PlatformLayerEvent) => void;

const platformLayerHandlers: PlatformLayerEventHandler[] = [];

export function emitPlatformLayerEvent(event: PlatformLayerEvent): void {
  platformLayerHandlers.forEach(handler => handler(event));
}

export function onPlatformLayerEvent(handler: PlatformLayerEventHandler): () => void {
  platformLayerHandlers.push(handler);
  return () => {
    const idx = platformLayerHandlers.indexOf(handler);
    if (idx >= 0) platformLayerHandlers.splice(idx, 1);
  };
}

// ── Guard: validate domain belongs to platform ──

export function isPlatformDomain(domainPath: string): boolean {
  return Object.values(PLATFORM_DOMAINS).includes(domainPath as any);
}
