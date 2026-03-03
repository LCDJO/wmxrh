/**
 * MenuDomainClassifier — Classifies every module into a functional domain.
 *
 * Domains:
 *   core_saas        → SaaS infrastructure (IAM, tenant admin, automation)
 *   security         → Security & compliance platform-level
 *   billing          → Financial & billing
 *   architecture     → Architecture intelligence & versioning
 *   monitoring       → Observability, analytics, health
 *   tenant_hr        → HR / workforce modules
 *   tenant_finance   → Payroll, compensation, benefits
 *   tenant_marketing → Ads, landing pages, growth
 *   tenant_automation → Tenant-level automation & integrations
 */

export const MODULE_DOMAINS = {
  core_saas: 'core_saas',
  security: 'security',
  billing: 'billing',
  architecture: 'architecture',
  monitoring: 'monitoring',
  tenant_hr: 'tenant_hr',
  tenant_finance: 'tenant_finance',
  tenant_marketing: 'tenant_marketing',
  tenant_automation: 'tenant_automation',
} as const;

export type ModuleDomain = typeof MODULE_DOMAINS[keyof typeof MODULE_DOMAINS];

export interface DomainClassification {
  domain: ModuleDomain;
  label: string;
  color: string;
  scope: 'platform' | 'tenant';
}

export const DOMAIN_METADATA: Record<ModuleDomain, DomainClassification> = {
  core_saas:          { domain: 'core_saas',          label: 'Core SaaS',            color: 'hsl(220 60% 50%)', scope: 'platform' },
  security:           { domain: 'security',           label: 'Security',             color: 'hsl(0 70% 50%)',   scope: 'platform' },
  billing:            { domain: 'billing',            label: 'Billing',              color: 'hsl(45 80% 50%)',  scope: 'platform' },
  architecture:       { domain: 'architecture',       label: 'Architecture',         color: 'hsl(270 50% 55%)', scope: 'platform' },
  monitoring:         { domain: 'monitoring',         label: 'Monitoring',           color: 'hsl(160 60% 45%)', scope: 'platform' },
  tenant_hr:          { domain: 'tenant_hr',          label: 'Tenant HR',            color: 'hsl(200 65% 50%)', scope: 'tenant' },
  tenant_finance:     { domain: 'tenant_finance',     label: 'Tenant Finance',       color: 'hsl(30 70% 50%)',  scope: 'tenant' },
  tenant_marketing:   { domain: 'tenant_marketing',   label: 'Tenant Marketing',     color: 'hsl(300 50% 55%)', scope: 'tenant' },
  tenant_automation:  { domain: 'tenant_automation',  label: 'Tenant Automation',    color: 'hsl(50 70% 50%)',  scope: 'tenant' },
};

/**
 * Canonical mapping: module_key → domain.
 * Every module in PLATFORM_MODULES must have an entry here.
 */
const MODULE_DOMAIN_MAP: Record<string, ModuleDomain> = {
  // ── Core SaaS ──
  iam: 'core_saas',
  tenant_admin: 'core_saas',

  // ── Security ──
  compliance: 'security',
  audit: 'security',
  labor_compliance: 'security',
  esocial_governance: 'security',

  // ── Billing ──
  billing: 'billing',

  // ── Architecture ──
  // (no current module keys — reserved for future arch modules)

  // ── Monitoring ──
  observability: 'monitoring',
  analytics: 'monitoring',
  autonomous_ops: 'monitoring',

  // ── Tenant HR ──
  core_hr: 'tenant_hr',
  employees: 'tenant_hr',
  departments: 'tenant_hr',
  positions: 'tenant_hr',
  companies: 'tenant_hr',
  groups: 'tenant_hr',
  health: 'tenant_hr',
  esocial: 'tenant_hr',
  agreements: 'tenant_hr',
  workforce_intelligence: 'tenant_hr',
  workforce_intel: 'tenant_hr',
  labor_rules: 'tenant_hr',
  nr_training: 'tenant_hr',
  support_module: 'tenant_hr',

  // ── Tenant Finance ──
  compensation: 'tenant_finance',
  payroll_simulation: 'tenant_finance',
  payroll_sim: 'tenant_finance',
  benefits: 'tenant_finance',
  compensation_engine: 'tenant_finance',

  // ── Tenant Marketing ──
  ads: 'tenant_marketing',
  growth: 'tenant_marketing',
  landing_engine: 'tenant_marketing',
  website_engine: 'tenant_marketing',

  // ── Tenant Automation ──
  automation: 'tenant_automation',
  fleet: 'tenant_automation',
  fleet_traccar: 'tenant_automation',
};

/**
 * Classify a module key into its functional domain.
 * Falls back to `core_saas` for unknown keys.
 */
export function classifyModule(moduleKey: string): ModuleDomain {
  return MODULE_DOMAIN_MAP[moduleKey] ?? 'core_saas';
}

/**
 * Get full classification metadata for a module key.
 */
export function getModuleClassification(moduleKey: string): DomainClassification {
  return DOMAIN_METADATA[classifyModule(moduleKey)];
}

/**
 * Group an array of module keys by domain.
 */
export function groupModulesByDomain(moduleKeys: string[]): Record<ModuleDomain, string[]> {
  const result = Object.fromEntries(
    Object.keys(MODULE_DOMAINS).map(d => [d, [] as string[]])
  ) as Record<ModuleDomain, string[]>;

  for (const key of moduleKeys) {
    const domain = classifyModule(key);
    result[domain].push(key);
  }

  return result;
}

/**
 * Get all module keys for a specific domain.
 */
export function getModulesByDomain(domain: ModuleDomain): string[] {
  return Object.entries(MODULE_DOMAIN_MAP)
    .filter(([, d]) => d === domain)
    .map(([key]) => key);
}

/**
 * Get domains filtered by scope (platform or tenant).
 */
export function getDomainsByScope(scope: 'platform' | 'tenant'): DomainClassification[] {
  return Object.values(DOMAIN_METADATA).filter(d => d.scope === scope);
}
