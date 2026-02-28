/**
 * Platform Experience Engine (PXE) — Core Types
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PXE — Controla a experiência completa do usuário/tenant       ║
 * ║                                                                 ║
 * ║  Baseado em: plano contratado, módulos ativos, permissões,     ║
 * ║  identidade, contexto operacional.                              ║
 * ║                                                                 ║
 * ║  PlatformExperienceEngine                                       ║
 * ║   ├── PlanRegistry              ← Catálogo de planos           ║
 * ║   ├── PlanLifecycleManager      ← Lifecycle SaaS               ║
 * ║   ├── TenantPlanResolver        ← Resolve plano do tenant      ║
 * ║   ├── PaymentPolicyEngine       ← Meios de pagamento           ║
 * ║   ├── ModuleAccessResolver      ← Acesso a módulos via plano   ║
 * ║   └── ExperienceOrchestrator    ← Adapta UI + navegação        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { ModuleKey } from '@/domains/platform/platform-modules';

// ══════════════════════════════════════════════════════════════════
// Plan Registry
// ══════════════════════════════════════════════════════════════════

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';
export type PlanStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface PlanDefinition {
  id: string;
  name: string;
  tier: PlanTier;
  description: string;
  /** Modules included in this plan */
  included_modules: (ModuleKey | string)[];
  /** Modules available as add-ons */
  addon_modules: (ModuleKey | string)[];
  /** Feature flags enabled for this plan */
  enabled_features: string[];
  /** Max users allowed (null = unlimited) */
  max_users: number | null;
  /** Max companies allowed */
  max_companies: number | null;
  /** Max employees allowed */
  max_employees: number | null;
  /** Storage quota in MB */
  storage_quota_mb: number | null;
  /** Pricing tiers */
  pricing: PlanPricing;
  /** Allowed payment methods */
  allowed_payment_methods: PaymentMethod[];
  /** Trial duration in days (0 = no trial) */
  trial_days: number;
  /** Whether this plan is publicly visible */
  is_public: boolean;
  /** Sort order for display */
  display_order: number;
  metadata?: Record<string, unknown>;
}

export interface PlanPricing {
  monthly_brl: number;
  annual_brl: number;
  per_user_brl?: number;
  per_employee_brl?: number;
  setup_fee_brl?: number;
  discount_annual_pct?: number;
}

export interface PlanRegistryAPI {
  register(plan: PlanDefinition): void;
  get(planId: string): PlanDefinition | null;
  getByTier(tier: PlanTier): PlanDefinition | null;
  list(): PlanDefinition[];
  listPublic(): PlanDefinition[];
  isModuleIncluded(planId: string, moduleKey: ModuleKey | string): boolean;
  isFeatureEnabled(planId: string, featureKey: string): boolean;
}

// ══════════════════════════════════════════════════════════════════
// Plan Lifecycle Manager
// ══════════════════════════════════════════════════════════════════

export type PlanTransition =
  | 'activate'
  | 'upgrade'
  | 'downgrade'
  | 'suspend'
  | 'cancel'
  | 'reactivate'
  | 'start_trial'
  | 'end_trial'
  | 'mark_past_due';

export interface PlanLifecycleEvent {
  tenant_id: string;
  from_plan: string | null;
  to_plan: string;
  transition: PlanTransition;
  reason?: string;
  performed_by?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PlanLifecycleManagerAPI {
  transition(tenantId: string, transition: PlanTransition, toPlanId: string, reason?: string): PlanLifecycleEvent;
  canTransition(tenantId: string, transition: PlanTransition): { allowed: boolean; reason?: string };
  history(tenantId: string): PlanLifecycleEvent[];
  currentStatus(tenantId: string): PlanStatus;
}

// ══════════════════════════════════════════════════════════════════
// Tenant Plan Resolver
// ══════════════════════════════════════════════════════════════════

export interface TenantPlanSnapshot {
  tenant_id: string;
  plan_id: string;
  plan_tier: PlanTier;
  status: PlanStatus;
  /** Currently included modules */
  active_modules: (ModuleKey | string)[];
  /** Add-on modules purchased */
  addon_modules: (ModuleKey | string)[];
  /** Effective features (plan + addons) */
  effective_features: string[];
  /** Usage stats */
  usage: TenantUsage;
  /** Trial info */
  trial_ends_at: number | null;
  /** Billing cycle */
  billing_cycle: BillingCycle;
  /** Next billing date */
  next_billing_at: number | null;
  resolved_at: number;
}

export interface TenantUsage {
  current_users: number;
  max_users: number | null;
  current_companies: number;
  max_companies: number | null;
  current_employees: number;
  max_employees: number | null;
  storage_used_mb: number;
  storage_quota_mb: number | null;
}

export interface TenantPlanResolverAPI {
  resolve(tenantId: string): TenantPlanSnapshot;
  isModuleAccessible(tenantId: string, moduleKey: ModuleKey | string): boolean;
  isFeatureAccessible(tenantId: string, featureKey: string): boolean;
  isWithinLimits(tenantId: string): { within: boolean; violations: string[] };
  getEffectiveModules(tenantId: string): (ModuleKey | string)[];
}

// ══════════════════════════════════════════════════════════════════
// Payment Policy Engine
// ══════════════════════════════════════════════════════════════════

export type PaymentMethod = 'credit_card' | 'boleto' | 'pix' | 'bank_transfer' | 'invoice';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded' | 'chargeback';

export interface PaymentPolicy {
  plan_tier: PlanTier;
  allowed_methods: PaymentMethod[];
  requires_contract: boolean;
  min_commitment_months: number;
  allow_installments: boolean;
  max_installments: number;
  late_payment_grace_days: number;
  auto_suspend_after_days: number;
  auto_cancel_after_days: number;
}

export interface PaymentPolicyEngineAPI {
  getPolicy(planTier: PlanTier): PaymentPolicy;
  getAllowedMethods(tenantId: string): PaymentMethod[];
  isMethodAllowed(tenantId: string, method: PaymentMethod): boolean;
  /** Validate payment method against plan's allowed methods — blocks if not allowed */
  validatePaymentMethod(tenantId: string, method: PaymentMethod, toPlanId?: string): { valid: boolean; reason?: string; allowed_methods?: PaymentMethod[] };
  canDowngrade(tenantId: string, toPlanId: string): { allowed: boolean; reason?: string };
  canUpgrade(tenantId: string, toPlanId: string): { allowed: boolean; reason?: string };
  calculateProration(tenantId: string, toPlanId: string): { amount_brl: number; credit_brl: number; net_brl: number };
}

// ══════════════════════════════════════════════════════════════════
// Module Access Resolver
// ══════════════════════════════════════════════════════════════════

export type ModuleAccessReason = 'plan_included' | 'addon' | 'trial' | 'override' | 'denied_plan' | 'denied_permission' | 'denied_suspended';

export interface ModuleAccessResult {
  module_key: ModuleKey | string;
  accessible: boolean;
  reason: ModuleAccessReason;
  /** If denied, what plan would grant access */
  required_plan?: PlanTier;
  /** If addon, when it expires */
  addon_expires_at?: number | null;
  /** Access mode during suspension: 'full' | 'read_only' | 'blocked' */
  access_mode?: 'full' | 'read_only' | 'blocked';
}

export interface ModuleAccessResolverAPI {
  check(tenantId: string, moduleKey: ModuleKey | string): ModuleAccessResult;
  checkAll(tenantId: string): ModuleAccessResult[];
  getAccessibleModules(tenantId: string): (ModuleKey | string)[];
  getDeniedModules(tenantId: string): ModuleAccessResult[];
  getUpgradePrompt(tenantId: string, moduleKey: ModuleKey | string): UpgradePrompt | null;
}

export interface UpgradePrompt {
  current_plan: PlanTier;
  required_plan: PlanTier;
  module_key: ModuleKey | string;
  module_label: string;
  price_diff_brl: number;
  message: string;
}

// ══════════════════════════════════════════════════════════════════
// Experience Orchestrator
// ══════════════════════════════════════════════════════════════════

export interface ExperienceProfile {
  tenant_id: string;
  plan_tier: PlanTier;
  /** Navigation items visible for this tenant */
  visible_navigation: string[];
  /** Hidden navigation items (plan-gated) */
  hidden_navigation: string[];
  /** Locked navigation items (shown but disabled with upgrade prompt) */
  locked_navigation: { path: string; upgrade_prompt: UpgradePrompt }[];
  /** Dashboard widgets available */
  available_widgets: string[];
  /** UI feature toggles */
  ui_features: Record<string, boolean>;
  /** Branding overrides (enterprise) */
  branding?: {
    logo_url?: string;
    primary_color?: string;
    app_name?: string;
  };
  resolved_at: number;
}

export interface ExperienceOrchestratorAPI {
  resolveProfile(tenantId: string): ExperienceProfile;
  isNavigationVisible(tenantId: string, path: string): boolean;
  isNavigationLocked(tenantId: string, path: string): boolean;
  getUpgradePromptForPath(tenantId: string, path: string): UpgradePrompt | null;
  getAvailableWidgets(tenantId: string): string[];
  getUIFeature(tenantId: string, featureKey: string): boolean;
}

// ══════════════════════════════════════════════════════════════════
// PXE Aggregate API
// ══════════════════════════════════════════════════════════════════

export interface PlatformExperienceEngineAPI {
  plans: PlanRegistryAPI;
  lifecycle: PlanLifecycleManagerAPI;
  tenantPlan: TenantPlanResolverAPI;
  payment: PaymentPolicyEngineAPI;
  moduleAccess: ModuleAccessResolverAPI;
  experience: ExperienceOrchestratorAPI;
}
