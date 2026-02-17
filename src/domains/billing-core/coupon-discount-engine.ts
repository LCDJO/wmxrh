/**
 * Coupon & Discount Engine
 *
 * ├── CouponManager            — CRUD de cupons
 * ├── CouponValidationService  — Valida elegibilidade
 * ├── CouponLifecycleManager   — Expira/exaure cupons
 * ├── DiscountEngine           — Aplica descontos em invoices
 * └── BillingAdjustmentService — Registra ajustes financeiros
 *
 * Todos os dados persistidos via Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CouponManagerAPI,
  CouponValidationServiceAPI,
  CouponLifecycleManagerAPI,
  DiscountEngineAPI,
  BillingAdjustmentServiceAPI,
  Coupon,
  CouponRedemption,
  BillingAdjustment,
  CreateCouponDTO,
  CouponValidationResult,
  DiscountApplication,
} from './types';

// ══════════════════════════════════════════════════════════════════
// CouponManager — CRUD
// ══════════════════════════════════════════════════════════════════

function createCouponManager(): CouponManagerAPI {
  return {
    async create(dto) {
      const { data, error } = await supabase
        .from('coupons')
        .insert([{
          code: dto.code.toUpperCase().trim(),
          name: dto.name,
          description: dto.description ?? null,
          discount_type: dto.discount_type,
          discount_value: dto.discount_value,
          applies_to: dto.applies_to ?? 'invoice',
          max_discount_brl: dto.max_discount_brl ?? null,
          applicable_plan_ids: dto.applicable_plan_ids ?? null,
          applicable_billing_cycles: dto.applicable_billing_cycles ?? null,
          min_plan_tier: dto.min_plan_tier ?? null,
          max_redemptions: dto.max_redemptions ?? null,
          max_redemptions_per_tenant: dto.max_redemptions_per_tenant ?? 1,
          valid_from: dto.valid_from ?? new Date().toISOString(),
          valid_until: dto.valid_until ?? null,
          duration_months: dto.duration_months ?? null,
          status: 'active',
          created_by: dto.created_by ?? null,
        }])
        .select()
        .single();

      if (error) throw new Error(`CouponManager.create: ${error.message}`);
      return data as unknown as Coupon;
    },

    async getById(couponId) {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .maybeSingle();

      if (error) throw new Error(`CouponManager.getById: ${error.message}`);
      return data as unknown as Coupon | null;
    },

    async getByCode(code) {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .maybeSingle();

      if (error) throw new Error(`CouponManager.getByCode: ${error.message}`);
      return data as unknown as Coupon | null;
    },

    async listAll(opts) {
      let query = supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (opts?.status) query = query.eq('status', opts.status);
      if (opts?.limit) query = query.limit(opts.limit);

      const { data, error } = await query;
      if (error) throw new Error(`CouponManager.listAll: ${error.message}`);
      return (data ?? []) as unknown as Coupon[];
    },

    async update(couponId, updates) {
      const { data, error } = await supabase
        .from('coupons')
        .update(updates as any)
        .eq('id', couponId)
        .select()
        .single();

      if (error) throw new Error(`CouponManager.update: ${error.message}`);
      return data as unknown as Coupon;
    },

    async archive(couponId) {
      return this.update(couponId, { status: 'archived' });
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CouponValidationService — Validates eligibility
// ══════════════════════════════════════════════════════════════════

function createCouponValidationService(): CouponValidationServiceAPI {
  return {
    async validate(code, tenantId, planId, billingCycle) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .maybeSingle();

      if (!coupon) return { valid: false, reason: 'Cupom não encontrado.' };

      const c = coupon as unknown as Coupon;

      // Status check
      if (c.status !== 'active') return { valid: false, reason: `Cupom ${c.status}.` };

      // Expiry check
      if (c.valid_until && new Date(c.valid_until) < new Date()) {
        return { valid: false, reason: 'Cupom expirado.' };
      }

      // Not yet valid
      if (new Date(c.valid_from) > new Date()) {
        return { valid: false, reason: 'Cupom ainda não é válido.' };
      }

      // Global redemption limit
      if (c.max_redemptions != null && c.current_redemptions >= c.max_redemptions) {
        return { valid: false, reason: 'Cupom esgotado.' };
      }

      // Per-tenant redemption limit
      if (c.max_redemptions_per_tenant != null) {
        const { count } = await supabase
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', c.id)
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'fully_applied']);

        if ((count ?? 0) >= c.max_redemptions_per_tenant) {
          return { valid: false, reason: 'Limite de uso por tenant atingido.' };
        }
      }

      // Plan restriction
      if (planId && c.applicable_plan_ids && c.applicable_plan_ids.length > 0) {
        if (!c.applicable_plan_ids.includes(planId)) {
          return { valid: false, reason: 'Cupom não aplicável a este plano.' };
        }
      }

      // Billing cycle restriction
      if (billingCycle && c.applicable_billing_cycles && c.applicable_billing_cycles.length > 0) {
        if (!c.applicable_billing_cycles.includes(billingCycle)) {
          return { valid: false, reason: 'Cupom não aplicável a este ciclo de cobrança.' };
        }
      }

      return { valid: true, coupon: c };
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CouponLifecycleManager — Manages expiration and exhaustion
// ══════════════════════════════════════════════════════════════════

function createCouponLifecycleManager(): CouponLifecycleManagerAPI {
  return {
    async expireExpiredCoupons() {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('coupons')
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lt('valid_until', now)
        .select('id');

      if (error) throw new Error(`CouponLifecycle.expire: ${error.message}`);
      return data?.length ?? 0;
    },

    async decrementCyclesRemaining() {
      // Fetch active redemptions with cycles remaining
      const { data: redemptions } = await supabase
        .from('coupon_redemptions')
        .select('id, billing_cycles_remaining')
        .eq('status', 'active')
        .gt('billing_cycles_remaining', 0);

      if (!redemptions || redemptions.length === 0) return 0;

      let expiredCount = 0;
      for (const r of redemptions) {
        const newCycles = (r.billing_cycles_remaining ?? 1) - 1;
        const newStatus = newCycles <= 0 ? 'fully_applied' : 'active';
        if (newCycles <= 0) expiredCount++;

        await supabase
          .from('coupon_redemptions')
          .update({
            billing_cycles_remaining: Math.max(0, newCycles),
            status: newStatus,
          })
          .eq('id', r.id);
      }

      return expiredCount;
    },

    async getActiveRedemptions(tenantId) {
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*, coupons(*)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) throw new Error(`CouponLifecycle.getActive: ${error.message}`);
      return (data ?? []) as unknown as CouponRedemption[];
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// DiscountEngine — Applies discounts to invoice amounts
// ══════════════════════════════════════════════════════════════════

function createDiscountEngine(): DiscountEngineAPI {
  const validator = createCouponValidationService();

  return {
    async applyDiscount(code, tenantId, subtotalBrl, planId, billingCycle) {
      const validation = await validator.validate(code, tenantId, planId, billingCycle);
      if (!validation.valid || !validation.coupon) {
        return {
          applied: false,
          reason: validation.reason ?? 'Validação falhou',
          discount_brl: 0,
          final_amount_brl: subtotalBrl,
        };
      }

      const coupon = validation.coupon;
      let discountBrl = 0;

      if (coupon.discount_type === 'percentage') {
        discountBrl = subtotalBrl * (Number(coupon.discount_value) / 100);
        if (coupon.max_discount_brl != null) {
          discountBrl = Math.min(discountBrl, Number(coupon.max_discount_brl));
        }
      } else if (coupon.discount_type === 'fixed_amount') {
        discountBrl = Math.min(Number(coupon.discount_value), subtotalBrl);
      } else if (coupon.discount_type === 'free_months') {
        // Full discount for N months — handled by lifecycle
        discountBrl = subtotalBrl;
      }

      discountBrl = Math.round(discountBrl * 100) / 100;

      // Create redemption
      const { data: redemption, error: rErr } = await supabase
        .from('coupon_redemptions')
        .insert([{
          coupon_id: coupon.id,
          tenant_id: tenantId,
          plan_id: planId ?? null,
          discount_applied_brl: discountBrl,
          billing_cycles_remaining: coupon.duration_months ?? null,
          status: 'active',
          expires_at: coupon.duration_months
            ? new Date(Date.now() + coupon.duration_months * 30 * 86400000).toISOString()
            : null,
        }])
        .select()
        .single();

      if (rErr) throw new Error(`DiscountEngine.apply: ${rErr.message}`);

      // Increment coupon redemption count
      await supabase
        .from('coupons')
        .update({ current_redemptions: coupon.current_redemptions + 1 })
        .eq('id', coupon.id);

      // Check if now exhausted
      if (coupon.max_redemptions != null && coupon.current_redemptions + 1 >= coupon.max_redemptions) {
        await supabase
          .from('coupons')
          .update({ status: 'exhausted' })
          .eq('id', coupon.id);
      }

      return {
        applied: true,
        coupon,
        redemption: redemption as unknown as CouponRedemption,
        discount_brl: discountBrl,
        final_amount_brl: Math.round((subtotalBrl - discountBrl) * 100) / 100,
      };
    },

    async getActiveDiscounts(tenantId) {
      const { data } = await supabase
        .from('coupon_redemptions')
        .select('*, coupons(*)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      return (data ?? []).map((r: any) => ({
        redemption_id: r.id,
        coupon_code: r.coupons?.code ?? '',
        coupon_name: r.coupons?.name ?? '',
        discount_type: r.coupons?.discount_type ?? 'percentage',
        discount_value: Number(r.coupons?.discount_value ?? 0),
        discount_applied_brl: Number(r.discount_applied_brl),
        cycles_remaining: r.billing_cycles_remaining,
      }));
    },

    async calculateRecurringDiscount(tenantId, subtotalBrl) {
      const activeDiscounts = await this.getActiveDiscounts(tenantId);
      let totalDiscount = 0;

      for (const d of activeDiscounts) {
        if (d.discount_type === 'percentage') {
          totalDiscount += subtotalBrl * (d.discount_value / 100);
        } else if (d.discount_type === 'fixed_amount') {
          totalDiscount += d.discount_value;
        } else if (d.discount_type === 'free_months' && d.cycles_remaining && d.cycles_remaining > 0) {
          totalDiscount += subtotalBrl;
        }
      }

      return Math.round(Math.min(totalDiscount, subtotalBrl) * 100) / 100;
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// BillingAdjustmentService — Records financial adjustments
// ══════════════════════════════════════════════════════════════════

function createBillingAdjustmentService(): BillingAdjustmentServiceAPI {
  return {
    async create(tenantId, dto) {
      const { data, error } = await supabase
        .from('billing_adjustments')
        .insert([{
          tenant_id: tenantId,
          invoice_id: dto.invoice_id ?? null,
          coupon_redemption_id: dto.coupon_redemption_id ?? null,
          adjustment_type: dto.adjustment_type,
          amount_brl: dto.amount_brl,
          description: dto.description,
          applied_by: dto.applied_by ?? null,
          metadata: (dto.metadata ?? {}) as any,
        }])
        .select()
        .single();

      if (error) throw new Error(`BillingAdjustment.create: ${error.message}`);
      return data as unknown as BillingAdjustment;
    },

    async listByTenant(tenantId, opts) {
      let query = supabase
        .from('billing_adjustments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('applied_at', { ascending: false });

      if (opts?.adjustment_type) query = query.eq('adjustment_type', opts.adjustment_type);
      if (opts?.limit) query = query.limit(opts.limit);

      const { data, error } = await query;
      if (error) throw new Error(`BillingAdjustment.listByTenant: ${error.message}`);
      return (data ?? []) as unknown as BillingAdjustment[];
    },

    async listByInvoice(invoiceId) {
      const { data, error } = await supabase
        .from('billing_adjustments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('applied_at', { ascending: false });

      if (error) throw new Error(`BillingAdjustment.listByInvoice: ${error.message}`);
      return (data ?? []) as unknown as BillingAdjustment[];
    },

    async getTotalAdjustments(tenantId) {
      const { data, error } = await supabase
        .from('billing_adjustments')
        .select('amount_brl')
        .eq('tenant_id', tenantId);

      if (error) throw new Error(`BillingAdjustment.getTotal: ${error.message}`);
      return (data ?? []).reduce((sum, r) => sum + Number(r.amount_brl), 0);
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// Composite Exports
// ══════════════════════════════════════════════════════════════════

export {
  createCouponManager,
  createCouponValidationService,
  createCouponLifecycleManager,
  createDiscountEngine,
  createBillingAdjustmentService,
};
