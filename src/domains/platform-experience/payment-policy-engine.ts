/**
 * PaymentPolicyEngine — Define meios de pagamento e regras de cobrança por plano
 */

import type {
  PaymentPolicyEngineAPI,
  PaymentPolicy,
  PaymentMethod,
  PlanTier,
  TenantPlanResolverAPI,
  PlanRegistryAPI,
} from './types';

const _proProfessionalPolicy = {
  plan_tier: 'pro' as PlanTier,
  allowed_methods: ['credit_card', 'pix', 'boleto', 'bank_transfer'] as any[],
  requires_contract: false,
  min_commitment_months: 1,
  allow_installments: true,
  max_installments: 12,
  late_payment_grace_days: 7,
  auto_suspend_after_days: 20,
  auto_cancel_after_days: 45,
};
const DEFAULT_POLICIES: Record<PlanTier, PaymentPolicy> = {
  free: {
    plan_tier: 'free',
    allowed_methods: [],
    requires_contract: false,
    min_commitment_months: 0,
    allow_installments: false,
    max_installments: 0,
    late_payment_grace_days: 0,
    auto_suspend_after_days: 0,
    auto_cancel_after_days: 0,
  },
  starter: {
    plan_tier: 'starter',
    allowed_methods: ['credit_card', 'pix', 'boleto'],
    requires_contract: false,
    min_commitment_months: 1,
    allow_installments: false,
    max_installments: 1,
    late_payment_grace_days: 5,
    auto_suspend_after_days: 15,
    auto_cancel_after_days: 30,
  },
  pro: _proProfessionalPolicy,
  professional: { ..._proProfessionalPolicy, plan_tier: 'professional' },
  enterprise: {
    plan_tier: 'enterprise',
    allowed_methods: ['credit_card', 'pix', 'boleto', 'bank_transfer', 'invoice'],
    requires_contract: true,
    min_commitment_months: 12,
    allow_installments: true,
    max_installments: 12,
    late_payment_grace_days: 15,
    auto_suspend_after_days: 30,
    auto_cancel_after_days: 90,
  },
  custom: {
    plan_tier: 'custom',
    allowed_methods: ['credit_card', 'pix', 'boleto', 'bank_transfer', 'invoice'],
    requires_contract: true,
    min_commitment_months: 12,
    allow_installments: true,
    max_installments: 12,
    late_payment_grace_days: 15,
    auto_suspend_after_days: 30,
    auto_cancel_after_days: 90,
  },
};

export function createPaymentPolicyEngine(
  tenantPlanResolver: TenantPlanResolverAPI,
  planRegistry: PlanRegistryAPI
): PaymentPolicyEngineAPI {
  return {
    getPolicy(planTier: PlanTier): PaymentPolicy {
      return DEFAULT_POLICIES[planTier] ?? DEFAULT_POLICIES.free;
    },

    getAllowedMethods(tenantId: string): PaymentMethod[] {
      const snap = tenantPlanResolver.resolve(tenantId);
      return DEFAULT_POLICIES[snap.plan_tier]?.allowed_methods ?? [];
    },

    isMethodAllowed(tenantId: string, method: PaymentMethod): boolean {
      return this.validatePaymentMethod(tenantId, method).valid;
    },

    validatePaymentMethod(tenantId: string, method: PaymentMethod, toPlanId?: string) {
      // If toPlanId provided, validate against target plan's allowed methods
      if (toPlanId) {
        const target = planRegistry.get(toPlanId);
        if (!target) return { valid: false, reason: 'Plano destino não encontrado' };
        const policy = DEFAULT_POLICIES[target.tier] ?? DEFAULT_POLICIES.free;
        if (!policy.allowed_methods.includes(method)) {
          return {
            valid: false,
            reason: `Método "${method}" não é permitido no plano ${target.name}. Métodos aceitos: ${policy.allowed_methods.join(', ')}`,
            allowed_methods: policy.allowed_methods,
          };
        }
        return { valid: true, allowed_methods: policy.allowed_methods };
      }
      // Validate against current tenant plan
      const allowed = this.getAllowedMethods(tenantId);
      if (!allowed.includes(method)) {
        return {
          valid: false,
          reason: `Método "${method}" não é permitido no plano atual. Métodos aceitos: ${allowed.join(', ')}`,
          allowed_methods: allowed,
        };
      }
      return { valid: true, allowed_methods: allowed };
    },

    canDowngrade(tenantId: string, toPlanId: string) {
      const snap = tenantPlanResolver.resolve(tenantId);
      const target = planRegistry.get(toPlanId);
      if (!target) return { allowed: false, reason: 'Plano destino não encontrado' };
      if (target.display_order >= (planRegistry.get(snap.plan_id)?.display_order ?? 0)) {
        return { allowed: false, reason: 'Não é downgrade' };
      }
      return { allowed: true };
    },

    canUpgrade(tenantId: string, toPlanId: string) {
      const snap = tenantPlanResolver.resolve(tenantId);
      const target = planRegistry.get(toPlanId);
      if (!target) return { allowed: false, reason: 'Plano destino não encontrado' };
      if (target.display_order <= (planRegistry.get(snap.plan_id)?.display_order ?? 0)) {
        return { allowed: false, reason: 'Não é upgrade' };
      }
      return { allowed: true };
    },

    calculateProration(tenantId: string, toPlanId: string) {
      const snap = tenantPlanResolver.resolve(tenantId);
      const currentPlan = planRegistry.get(snap.plan_id);
      const targetPlan = planRegistry.get(toPlanId);
      const currentMonthly = currentPlan?.pricing.monthly_brl ?? 0;
      const targetMonthly = targetPlan?.pricing.monthly_brl ?? 0;
      // Simplified: full month proration
      return {
        amount_brl: targetMonthly,
        credit_brl: currentMonthly,
        net_brl: targetMonthly - currentMonthly,
      };
    },
  };
}
