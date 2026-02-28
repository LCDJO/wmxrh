/**
 * CouponPolicyResolver — Enforces strict coupon application policies.
 *
 * Rules:
 * 1. Validate coupon before applying (delegates to CouponValidationService)
 * 2. Prevent coupon after billing cycle has started (> 24h after cycle_start_date)
 * 3. Prevent retroactive coupon application (invoice already generated for current cycle)
 * 4. Limit usage per tenant (max_redemptions_per_tenant + fraud-aware cooldown)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CouponValidationResult,
  Coupon,
  CouponValidationOpts,
} from './types';

// ── Policy Config ────────────────────────────────────────────────
const CYCLE_GRACE_HOURS = 24; // hours after cycle start where coupon is still allowed
const REDEMPTION_COOLDOWN_DAYS = 30; // min days between redemptions for same tenant
const MAX_COUPONS_PER_CYCLE = 1; // max coupons per billing cycle

export interface CouponPolicyResult extends CouponValidationResult {
  policy_violation?: string;
  policy_code?:
    | 'CYCLE_STARTED'
    | 'RETROACTIVE'
    | 'COOLDOWN'
    | 'CYCLE_LIMIT'
    | 'REVIEW_REQUIRED';
}

export interface CouponPolicyResolverAPI {
  /** Full policy-aware validation before applying a coupon */
  resolve(
    code: string,
    tenantId: string,
    planId?: string,
    billingCycle?: string,
    opts?: CouponValidationOpts,
  ): Promise<CouponPolicyResult>;

  /** Check if tenant is eligible for any coupon right now */
  canApplyCoupon(tenantId: string): Promise<{ eligible: boolean; reason?: string }>;
}

export function createCouponPolicyResolver(): CouponPolicyResolverAPI {
  return {
    async resolve(code, tenantId, planId, billingCycle, opts) {
      // ── Step 0: Check if tenant is under fraud review ──────
      const { data: tenantPlan } = await supabase
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (tenantPlan?.review_required) {
        return {
          valid: false,
          reason: 'Conta em revisão. Cupons bloqueados temporariamente.',
          policy_violation: 'Tenant flagged for review',
          policy_code: 'REVIEW_REQUIRED',
        };
      }

      // ── Step 1: Standard coupon validation ─────────────────
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .maybeSingle();

      if (!coupon) return { valid: false, reason: 'Cupom não encontrado.' };

      const c = coupon as unknown as Coupon;

      if (c.status !== 'active') return { valid: false, reason: `Cupom ${c.status}.` };

      if (c.valid_until && new Date(c.valid_until) < new Date()) {
        return { valid: false, reason: 'Cupom expirado.' };
      }

      if (new Date(c.valid_from) > new Date()) {
        return { valid: false, reason: 'Cupom ainda não é válido.' };
      }

      if (c.max_redemptions != null && c.current_redemptions >= c.max_redemptions) {
        return { valid: false, reason: 'Cupom esgotado.' };
      }

      if (c.tenant_scope && c.tenant_scope !== tenantId) {
        return { valid: false, reason: 'Cupom não disponível para este cliente.' };
      }

      // Plan restriction
      if (planId && c.applicable_plan_ids?.length) {
        if (!c.applicable_plan_ids.includes(planId)) {
          return { valid: false, reason: 'Cupom não aplicável a este plano.' };
        }
      }

      // Billing cycle restriction
      if (billingCycle && c.applicable_billing_cycles?.length) {
        if (!c.applicable_billing_cycles.includes(billingCycle)) {
          return { valid: false, reason: 'Cupom não aplicável a este ciclo.' };
        }
      }

      // Module restriction
      if (opts?.moduleId && c.allowed_modules?.length) {
        if (!c.allowed_modules.includes(opts.moduleId)) {
          return { valid: false, reason: 'Cupom não aplicável a este módulo.' };
        }
      }

      // Payment method restriction
      if (opts?.paymentMethod && c.allowed_payment_methods?.length) {
        if (!c.allowed_payment_methods.includes(opts.paymentMethod)) {
          return { valid: false, reason: 'Cupom não aplicável a este método de pagamento.' };
        }
      }

      // ── Step 2: Per-tenant limit ───────────────────────────
      if (c.max_redemptions_per_tenant != null) {
        const { count } = await supabase
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', c.id)
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'fully_applied']);

        if ((count ?? 0) >= c.max_redemptions_per_tenant) {
          return {
            valid: false,
            reason: 'Limite de uso deste cupom por tenant atingido.',
            policy_code: 'CYCLE_LIMIT',
          };
        }
      }

      // ── Step 3: Prevent coupon after cycle started ─────────
      if (tenantPlan?.cycle_start_date) {
        const cycleStart = new Date(tenantPlan.cycle_start_date);
        const graceEnd = new Date(cycleStart.getTime() + CYCLE_GRACE_HOURS * 3600_000);
        const now = new Date();

        if (now > graceEnd) {
          return {
            valid: false,
            reason: `Cupom só pode ser aplicado nas primeiras ${CYCLE_GRACE_HOURS}h do ciclo de cobrança.`,
            policy_violation: `Cycle started at ${cycleStart.toISOString()}, grace ended at ${graceEnd.toISOString()}`,
            policy_code: 'CYCLE_STARTED',
          };
        }
      }

      // ── Step 4: Prevent retroactive application ────────────
      if (tenantPlan) {
        const { count: invoiceCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', tenantPlan.cycle_start_date ?? tenantPlan.started_at)
          .in('status', ['paid', 'processing']);

        if ((invoiceCount ?? 0) > 0) {
          return {
            valid: false,
            reason: 'Não é possível aplicar cupom após fatura já gerada para o ciclo atual.',
            policy_violation: 'Invoice already generated for current cycle',
            policy_code: 'RETROACTIVE',
          };
        }
      }

      // ── Step 5: Cooldown between redemptions ───────────────
      const cooldownDate = new Date(
        Date.now() - REDEMPTION_COOLDOWN_DAYS * 86400_000,
      ).toISOString();

      const { count: recentRedemptions } = await supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('redeemed_at', cooldownDate)
        .in('status', ['active', 'fully_applied']);

      if ((recentRedemptions ?? 0) >= MAX_COUPONS_PER_CYCLE) {
        return {
          valid: false,
          reason: `Limite de ${MAX_COUPONS_PER_CYCLE} cupom(ns) a cada ${REDEMPTION_COOLDOWN_DAYS} dias.`,
          policy_violation: `${recentRedemptions} redemptions in last ${REDEMPTION_COOLDOWN_DAYS} days`,
          policy_code: 'COOLDOWN',
        };
      }

      return { valid: true, coupon: c };
    },

    async canApplyCoupon(tenantId) {
      // Check fraud review
      const { data: tp } = await supabase
        .from('tenant_plans')
        .select('review_required, cycle_start_date, started_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (tp?.review_required) {
        return { eligible: false, reason: 'Conta em revisão.' };
      }

      // Check cycle timing
      if (tp?.cycle_start_date) {
        const graceEnd = new Date(
          new Date(tp.cycle_start_date).getTime() + CYCLE_GRACE_HOURS * 3600_000,
        );
        if (new Date() > graceEnd) {
          return { eligible: false, reason: 'Fora da janela de aplicação de cupom.' };
        }
      }

      // Check retroactive
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', tp?.cycle_start_date ?? tp?.started_at ?? new Date().toISOString())
        .in('status', ['paid', 'processing']);

      if ((count ?? 0) > 0) {
        return { eligible: false, reason: 'Fatura já gerada para ciclo atual.' };
      }

      // Check cooldown
      const cooldownDate = new Date(
        Date.now() - REDEMPTION_COOLDOWN_DAYS * 86400_000,
      ).toISOString();

      const { count: recent } = await supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('redeemed_at', cooldownDate)
        .in('status', ['active', 'fully_applied']);

      if ((recent ?? 0) >= MAX_COUPONS_PER_CYCLE) {
        return { eligible: false, reason: 'Cooldown entre cupons ainda ativo.' };
      }

      return { eligible: true };
    },
  };
}
