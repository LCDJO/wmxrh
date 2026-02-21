/**
 * ══════════════════════════════════════════════════════════
 * TENANT LAYER (Client) — Registry & Manifest
 * ══════════════════════════════════════════════════════════
 *
 * The Tenant Layer contains all operational, client-scoped
 * domains. Every piece of data here is isolated by tenant_id
 * and protected by RLS policies.
 *
 *  ✅ Stores operational client data
 *  ✅ Runs business logic scoped to tenant
 *  ✅ Consumes normalized events from Platform Layer
 *  ✅ Never accesses other tenants' data
 */

export const TENANT_DOMAINS = {
  // ── Core HR ──
  EMPLOYEE:                 'employee',
  COMPANY:                  'company',
  COMPANY_GROUP:            'company-group',
  DEPARTMENT:               'department',
  POSITION:                 'position',
  COMPENSATION:             'compensation',

  // ── Compliance & Labor ──
  LABOR_COMPLIANCE:         'labor-compliance',
  LABOR_RULES:              'labor-rules',
  COMPLIANCE:               'compliance',
  ESOCIAL:                  'esocial',
  ESOCIAL_GOVERNANCE:       'esocial-governance',

  // ── Occupational Safety ──
  EPI_INVENTORY:            'epi-inventory',
  EPI_LIFECYCLE:            'epi-lifecycle',
  NR_TRAINING_LIFECYCLE:    'nr-training-lifecycle',
  SAFETY_AUTOMATION:        'safety-automation',
  OCCUPATIONAL_INTEL:       'occupational-intelligence',

  // ── Fleet (Tenant-scoped operations) ──
  FLEET_OPERATIONS:         'fleet-compliance',  // tenant-scoped layer over platform core

  // ── Intelligence & Analytics ──
  WORKFORCE_INTELLIGENCE:   'workforce-intelligence',
  CAREER_INTELLIGENCE:      'career-intelligence',
  PAYROLL_SIMULATION:       'payroll-simulation',
  GOVERNANCE_AI:            'governance-ai',

  // ── Documents & Agreements ──
  EMPLOYEE_AGREEMENT:       'employee-agreement',
  ANNOUNCEMENTS:            'announcements',

  // ── Tenant Operations ──
  NOTIFICATIONS:            'notifications',
  ADAPTIVE_ONBOARDING:      'adaptive-onboarding',
  AUTOMATION:               'automation',
  SUPPORT:                  'support',
  GOVERNANCE:               'governance',
  INTEGRATION_AUTOMATION:   'integration-automation',
  MENU_STRUCTURE:           'menu-structure',
} as const;

export type TenantDomainKey = keyof typeof TENANT_DOMAINS;

// ── Capabilities ──

export interface TenantCapability {
  key: TenantDomainKey;
  domain: string;
  description: string;
  storesClientData: true;
  scope: 'tenant';
  requiresRLS: true;
}

export const TENANT_CAPABILITIES: TenantCapability[] = [
  {
    key: 'EMPLOYEE',
    domain: TENANT_DOMAINS.EMPLOYEE,
    description: 'Employee records, profiles, onboarding — all scoped by tenant_id',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'COMPANY',
    domain: TENANT_DOMAINS.COMPANY,
    description: 'Company management within tenant boundary',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'LABOR_COMPLIANCE',
    domain: TENANT_DOMAINS.LABOR_COMPLIANCE,
    description: 'Tenant-specific labor compliance checks and violation tracking',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'FLEET_OPERATIONS',
    domain: TENANT_DOMAINS.FLEET_OPERATIONS,
    description: 'Tenant-scoped fleet monitoring, warnings and behavioral scoring',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'WORKFORCE_INTELLIGENCE',
    domain: TENANT_DOMAINS.WORKFORCE_INTELLIGENCE,
    description: 'Tenant analytics — headcount, turnover, risk insights',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'PAYROLL_SIMULATION',
    domain: TENANT_DOMAINS.PAYROLL_SIMULATION,
    description: 'Payroll simulation engine with CCT override support',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'SAFETY_AUTOMATION',
    domain: TENANT_DOMAINS.SAFETY_AUTOMATION,
    description: 'Automated safety workflows — EPI, training, NR compliance',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'EMPLOYEE_AGREEMENT',
    domain: TENANT_DOMAINS.EMPLOYEE_AGREEMENT,
    description: 'Digital agreement templates, signing flows and version control',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'NOTIFICATIONS',
    domain: TENANT_DOMAINS.NOTIFICATIONS,
    description: 'In-app notifications scoped to tenant users',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
  {
    key: 'AUTOMATION',
    domain: TENANT_DOMAINS.AUTOMATION,
    description: 'Tenant automation rules and workflow execution',
    storesClientData: true,
    scope: 'tenant',
    requiresRLS: true,
  },
];

// ── Tenant Event Bus ──

export type TenantLayerEvent =
  | { type: 'EMPLOYEE_CREATED';            tenantId: string; payload: { employeeId: string } }
  | { type: 'COMPLIANCE_VIOLATION_FOUND';   tenantId: string; payload: { violationId: string; severity: string } }
  | { type: 'WARNING_ISSUED';              tenantId: string; payload: { warningId: string; employeeId: string } }
  | { type: 'FLEET_BEHAVIOR_DETECTED';     tenantId: string; payload: { eventId: string; severity: string } }
  | { type: 'PAYROLL_SIMULATED';           tenantId: string; payload: { simulationId: string } }
  | { type: 'AGREEMENT_SIGNED';            tenantId: string; payload: { agreementId: string } };

type TenantLayerEventHandler = (event: TenantLayerEvent) => void;

const tenantLayerHandlers: TenantLayerEventHandler[] = [];

export function emitTenantLayerEvent(event: TenantLayerEvent): void {
  tenantLayerHandlers.forEach(handler => handler(event));
}

export function onTenantLayerEvent(handler: TenantLayerEventHandler): () => void {
  tenantLayerHandlers.push(handler);
  return () => {
    const idx = tenantLayerHandlers.indexOf(handler);
    if (idx >= 0) tenantLayerHandlers.splice(idx, 1);
  };
}

// ── Guard: validate domain belongs to tenant ──

export function isTenantDomain(domainPath: string): boolean {
  return Object.values(TENANT_DOMAINS).includes(domainPath as any);
}
