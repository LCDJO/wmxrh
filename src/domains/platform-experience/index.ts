/**
 * Platform Experience Engine (PXE) — Barrel Export
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PXE — Controla a experiência completa do usuário/tenant       ║
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

// ── Factory functions ────────────────────────────────────────
export { createPlanRegistry } from './plan-registry';
export { createPlanLifecycleManager } from './plan-lifecycle-manager';
export { createTenantPlanResolver } from './tenant-plan-resolver';
export { createPaymentPolicyEngine } from './payment-policy-engine';
export { createModuleAccessResolver } from './module-access-resolver';
export { createExperienceOrchestrator } from './experience-orchestrator';

// ── Aggregate factory ────────────────────────────────────────
export { createPlatformExperienceEngine } from './platform-experience-engine';

// ── Types ────────────────────────────────────────────────────
export type {
  // Plan
  PlanDefinition,
  PlanTier,
  PlanStatus,
  PlanPricing,
  BillingCycle,
  PlanRegistryAPI,

  // Lifecycle
  PlanTransition,
  PlanLifecycleEvent,
  PlanLifecycleManagerAPI,

  // Tenant Plan
  TenantPlanSnapshot,
  TenantUsage,
  TenantPlanResolverAPI,

  // Payment
  PaymentMethod,
  PaymentStatus,
  PaymentPolicy,
  PaymentPolicyEngineAPI,

  // Module Access
  ModuleAccessReason,
  ModuleAccessResult,
  ModuleAccessResolverAPI,
  UpgradePrompt,

  // Experience
  ExperienceProfile,
  ExperienceOrchestratorAPI,

  // Aggregate
  PlatformExperienceEngineAPI,
} from './types';
