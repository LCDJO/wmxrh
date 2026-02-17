/**
 * BillingCalculator — Calcula valores de cobrança por tenant/plano
 *
 * tenant_total = base_price + soma(modules adicionais com price_override)
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlanRegistryAPI, TenantPlanResolverAPI, BillingCycle } from '@/domains/platform-experience/types';
import type { BillingCalculatorAPI, BillingCalculation, BillingLineItem, PlanChangeBreakdown } from './types';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function cycleMonths(cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'annual': return 12;
    default: return 1;
  }
}

interface PlanModuleRow {
  module_key: string;
  module_price_override: number | null;
}

/** Fetch addon modules (those with a price override) for a plan */
async function fetchPlanModules(planId: string): Promise<PlanModuleRow[]> {
  const { data } = await supabase
    .from('plan_modules')
    .select('module_key, module_price_override')
    .eq('plan_id', planId);
  return (data ?? []) as PlanModuleRow[];
}

export function createBillingCalculator(
  planRegistry: PlanRegistryAPI,
  tenantPlan: TenantPlanResolverAPI
): BillingCalculatorAPI {

  function buildCalculationSync(
    tenantId: string,
    planId: string,
    cycle: BillingCycle,
    planModules: PlanModuleRow[],
    usage?: { users: number; employees: number }
  ): BillingCalculation {
    const plan = planRegistry.get(planId);
    if (!plan) {
      return {
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: cycle,
        line_items: [],
        subtotal_brl: 0,
        usage_overage_brl: 0,
        discount_brl: 0,
        coupon_discount_brl: 0,
        total_brl: 0,
        period_start: new Date().toISOString().slice(0, 10),
        period_end: new Date().toISOString().slice(0, 10),
        calculated_at: Date.now(),
      };
    }

    const items: BillingLineItem[] = [];
    const months = cycleMonths(cycle);
    const baseMonthly = plan.pricing.monthly_brl;
    const isAnnual = cycle === 'annual';
    const monthlyRate = isAnnual ? plan.pricing.annual_brl / 12 : baseMonthly;

    // 1. Base plan price
    items.push({
      description: `${plan.name} — ${cycle}`,
      quantity: months,
      unit_price_brl: monthlyRate,
      total_brl: monthlyRate * months,
      type: 'plan_base',
    });

    // 2. Addon modules (those with module_price_override > 0)
    for (const mod of planModules) {
      if (mod.module_price_override != null && mod.module_price_override > 0) {
        items.push({
          description: `Módulo: ${mod.module_key}`,
          quantity: months,
          unit_price_brl: mod.module_price_override,
          total_brl: mod.module_price_override * months,
          type: 'addon',
        });
      }
    }

    // 3. Per-user pricing
    const currentUsers = usage?.users ?? 0;
    if (plan.pricing.per_user_brl && currentUsers > 0) {
      items.push({
        description: `Usuários adicionais (${currentUsers})`,
        quantity: currentUsers,
        unit_price_brl: plan.pricing.per_user_brl * months,
        total_brl: plan.pricing.per_user_brl * currentUsers * months,
        type: 'per_user',
      });
    }

    // 4. Per-employee pricing
    const currentEmployees = usage?.employees ?? 0;
    if (plan.pricing.per_employee_brl && currentEmployees > 0) {
      items.push({
        description: `Colaboradores (${currentEmployees})`,
        quantity: currentEmployees,
        unit_price_brl: plan.pricing.per_employee_brl * months,
        total_brl: plan.pricing.per_employee_brl * currentEmployees * months,
        type: 'per_employee',
      });
    }

    // 5. Setup fee
    if (plan.pricing.setup_fee_brl && plan.pricing.setup_fee_brl > 0) {
      items.push({
        description: 'Taxa de implantação',
        quantity: 1,
        unit_price_brl: plan.pricing.setup_fee_brl,
        total_brl: plan.pricing.setup_fee_brl,
        type: 'setup',
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.total_brl, 0);

    // 6. Annual discount
    let discount = 0;
    if (isAnnual && plan.pricing.discount_annual_pct) {
      discount = subtotal * (plan.pricing.discount_annual_pct / 100);
      items.push({
        description: `Desconto anual (${plan.pricing.discount_annual_pct}%)`,
        quantity: 1,
        unit_price_brl: -discount,
        total_brl: -discount,
        type: 'discount',
      });
    }

    const now = new Date();
    const periodStart = now.toISOString().slice(0, 10);
    const periodEnd = addMonths(now, months).toISOString().slice(0, 10);

    return {
      tenant_id: tenantId,
      plan_id: planId,
      billing_cycle: cycle,
      line_items: items,
      subtotal_brl: Math.round(subtotal * 100) / 100,
      usage_overage_brl: 0,
      discount_brl: Math.round(discount * 100) / 100,
      coupon_discount_brl: 0,
      total_brl: Math.round((subtotal - discount) * 100) / 100,
      period_start: periodStart,
      period_end: periodEnd,
      calculated_at: Date.now(),
    };
  }

  return {
    calculate(tenantId) {
      const snap = tenantPlan.resolve(tenantId);
      // Sync fallback (no modules fetched — use for quick local calc)
      return buildCalculationSync(tenantId, snap.plan_id, snap.billing_cycle, [], {
        users: snap.usage.current_users,
        employees: snap.usage.current_employees,
      });
    },

    calculateForPlan(tenantId, planId, cycle) {
      const snap = tenantPlan.resolve(tenantId);
      return buildCalculationSync(tenantId, planId, cycle, [], {
        users: snap.usage.current_users,
        employees: snap.usage.current_employees,
      });
    },

    calculateProration(tenantId, fromPlanId, toPlanId) {
      const snap = tenantPlan.resolve(tenantId);
      const fromCalc = buildCalculationSync(tenantId, fromPlanId, snap.billing_cycle, []);
      const toCalc = buildCalculationSync(tenantId, toPlanId, snap.billing_cycle, []);

      // Real prorata: calculate based on remaining days in cycle
      const now = new Date();
      const periodEnd = snap.next_billing_at ? new Date(snap.next_billing_at) : addMonths(now, cycleMonths(snap.billing_cycle));
      const totalDays = Math.ceil((periodEnd.getTime() - addMonths(periodEnd, -cycleMonths(snap.billing_cycle)).getTime()) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const dailyDiff = (toCalc.total_brl - fromCalc.total_brl) / totalDays;
      const prorationAmount = Math.round(dailyDiff * remainingDays * 100) / 100;

      return {
        ...toCalc,
        line_items: [
          {
            description: `Prorata: ${fromPlanId} → ${toPlanId} (${remainingDays}/${totalDays} dias)`,
            quantity: remainingDays,
            unit_price_brl: Math.round(dailyDiff * 100) / 100,
            total_brl: prorationAmount,
            type: 'proration' as const,
          },
        ],
        subtotal_brl: Math.max(0, prorationAmount),
        usage_overage_brl: 0,
        discount_brl: 0,
        coupon_discount_brl: 0,
        total_brl: Math.max(0, prorationAmount),
      };
    },

    calculatePlanChange(tenantId, fromPlanId, toPlanId, opts) {
      const snap = tenantPlan.resolve(tenantId);
      const cycle = snap.billing_cycle;
      const previewCycles = opts?.preview_cycles ?? 3;

      // 1. Prorata do ciclo atual
      const proration = this.calculateProration(tenantId, fromPlanId, toPlanId);

      // 2. Valor recorrente do novo plano (ciclo cheio)
      const recurring = this.calculateForPlan(tenantId, toPlanId, cycle);

      // 3. Dias restantes / totais
      const now = new Date();
      const months = cycleMonths(cycle);
      const periodEnd = snap.next_billing_at ? new Date(snap.next_billing_at) : addMonths(now, months);
      const periodStart = addMonths(periodEnd, -months);
      const totalCycleDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // 4. Projeção dos próximos N ciclos
      const nextCycles: PlanChangeBreakdown['next_cycles'] = [];
      let cycleStart = periodEnd;
      for (let i = 1; i <= previewCycles; i++) {
        const cycleEnd = addMonths(cycleStart, months);
        nextCycles.push({
          cycle_number: i,
          period_start: cycleStart.toISOString().slice(0, 10),
          period_end: cycleEnd.toISOString().slice(0, 10),
          total_brl: recurring.total_brl,
        });
        cycleStart = cycleEnd;
      }

      return {
        proration,
        recurring,
        next_cycles: nextCycles,
        remaining_days: remainingDays,
        total_cycle_days: totalCycleDays,
      };
    },
  };
}

/**
 * Async version — Full invoice calculation with usage + discounts.
 *
 * invoice_total = base_plan_price + usage_overage - discounts
 *
 * Use this for invoice generation where accuracy matters.
 */
export async function calculateInvoiceTotal(
  planRegistry: PlanRegistryAPI,
  tenantPlan: TenantPlanResolverAPI,
  tenantId: string,
  opts?: {
    usageCost?: import('./types').UsageCostBreakdown;
    couponDiscountBrl?: number;
  }
): Promise<BillingCalculation> {
  const snap = tenantPlan.resolve(tenantId);
  const modules = await fetchPlanModules(snap.plan_id);

  const calc = createBillingCalculator(planRegistry, tenantPlan);
  const plan = planRegistry.get(snap.plan_id);
  if (!plan) return calc.calculate(tenantId);

  const items: BillingLineItem[] = [];
  const months = cycleMonths(snap.billing_cycle);
  const isAnnual = snap.billing_cycle === 'annual';
  const monthlyRate = isAnnual ? plan.pricing.annual_brl / 12 : plan.pricing.monthly_brl;

  // ── 1. Base plan price ──────────────────────────────────────
  const basePlanPrice = monthlyRate * months;
  items.push({
    description: `${plan.name} — ${snap.billing_cycle}`,
    quantity: months,
    unit_price_brl: monthlyRate,
    total_brl: basePlanPrice,
    type: 'plan_base',
  });

  // ── 2. Addon modules ───────────────────────────────────────
  for (const mod of modules) {
    if (mod.module_price_override != null && mod.module_price_override > 0) {
      items.push({
        description: `Módulo: ${mod.module_key}`,
        quantity: months,
        unit_price_brl: mod.module_price_override,
        total_brl: mod.module_price_override * months,
        type: 'addon',
      });
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.total_brl, 0);

  // ── 3. Usage overage ───────────────────────────────────────
  let usageOverageBrl = 0;
  if (opts?.usageCost) {
    usageOverageBrl = opts.usageCost.total_usage_brl;
    for (const line of opts.usageCost.line_items) {
      items.push({
        description: `Uso: ${line.metric_key} (${line.quantity} ${line.unit})`,
        quantity: line.quantity,
        unit_price_brl: line.unit_price_brl,
        total_brl: line.total_brl,
        type: 'usage',
      });
    }
  }

  // ── 4. Plan discount (annual) ──────────────────────────────
  let discount = 0;
  if (isAnnual && plan.pricing.discount_annual_pct) {
    discount = subtotal * (plan.pricing.discount_annual_pct / 100);
    items.push({
      description: `Desconto anual (${plan.pricing.discount_annual_pct}%)`,
      quantity: 1,
      unit_price_brl: -discount,
      total_brl: -discount,
      type: 'discount',
    });
  }

  // ── 5. Coupon discount ─────────────────────────────────────
  const couponDiscountBrl = opts?.couponDiscountBrl ?? 0;
  if (couponDiscountBrl > 0) {
    items.push({
      description: `Desconto de cupom`,
      quantity: 1,
      unit_price_brl: -couponDiscountBrl,
      total_brl: -couponDiscountBrl,
      type: 'coupon_discount',
    });
  }

  // ── TOTAL = base + usage - discounts ───────────────────────
  const totalBrl = subtotal + usageOverageBrl - discount - couponDiscountBrl;

  const now = new Date();
  return {
    tenant_id: tenantId,
    plan_id: snap.plan_id,
    billing_cycle: snap.billing_cycle,
    line_items: items,
    subtotal_brl: Math.round(subtotal * 100) / 100,
    usage_overage_brl: Math.round(usageOverageBrl * 100) / 100,
    discount_brl: Math.round(discount * 100) / 100,
    coupon_discount_brl: Math.round(couponDiscountBrl * 100) / 100,
    total_brl: Math.round(Math.max(0, totalBrl) * 100) / 100,
    period_start: now.toISOString().slice(0, 10),
    period_end: addMonths(now, months).toISOString().slice(0, 10),
    calculated_at: Date.now(),
  };
}

/** @deprecated Use calculateInvoiceTotal instead */
export const calculateTenantTotal = calculateInvoiceTotal;
