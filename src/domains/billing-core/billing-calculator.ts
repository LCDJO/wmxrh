/**
 * BillingCalculator — Calcula valores de cobrança por tenant/plano
 *
 * tenant_total = base_price + soma(modules adicionais com price_override)
 */

import { supabase } from '@/integrations/supabase/client';
import type { PlanRegistryAPI, TenantPlanResolverAPI, BillingCycle } from '@/domains/platform-experience/types';
import type { BillingCalculatorAPI, BillingCalculation, BillingLineItem } from './types';

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
        discount_brl: 0,
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
      discount_brl: Math.round(discount * 100) / 100,
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
      const diff = toCalc.total_brl - fromCalc.total_brl;

      return {
        ...toCalc,
        line_items: [
          {
            description: `Proration: upgrade ${fromPlanId} → ${toPlanId}`,
            quantity: 1,
            unit_price_brl: diff,
            total_brl: diff,
            type: 'proration' as const,
          },
        ],
        subtotal_brl: Math.max(0, diff),
        discount_brl: 0,
        total_brl: Math.max(0, diff),
      };
    },
  };
}

/**
 * Async version — fetches plan_modules from DB for accurate calculation
 * Use this for invoice generation where accuracy matters.
 *
 * tenant_total = base_price + soma(modules adicionais com price_override)
 */
export async function calculateTenantTotal(
  planRegistry: PlanRegistryAPI,
  tenantPlan: TenantPlanResolverAPI,
  tenantId: string
): Promise<BillingCalculation> {
  const snap = tenantPlan.resolve(tenantId);
  const modules = await fetchPlanModules(snap.plan_id);

  const calc = createBillingCalculator(planRegistry, tenantPlan);
  // We need to rebuild with modules — use the internal builder via a fresh instance
  const plan = planRegistry.get(snap.plan_id);
  if (!plan) return calc.calculate(tenantId);

  const items: BillingLineItem[] = [];
  const months = cycleMonths(snap.billing_cycle);
  const isAnnual = snap.billing_cycle === 'annual';
  const monthlyRate = isAnnual ? plan.pricing.annual_brl / 12 : plan.pricing.monthly_brl;

  // Base
  items.push({
    description: `${plan.name} — ${snap.billing_cycle}`,
    quantity: months,
    unit_price_brl: monthlyRate,
    total_brl: monthlyRate * months,
    type: 'plan_base',
  });

  // Addon modules
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
  let discount = 0;
  if (isAnnual && plan.pricing.discount_annual_pct) {
    discount = subtotal * (plan.pricing.discount_annual_pct / 100);
  }

  const now = new Date();
  return {
    tenant_id: tenantId,
    plan_id: snap.plan_id,
    billing_cycle: snap.billing_cycle,
    line_items: items,
    subtotal_brl: Math.round(subtotal * 100) / 100,
    discount_brl: Math.round(discount * 100) / 100,
    total_brl: Math.round((subtotal - discount) * 100) / 100,
    period_start: now.toISOString().slice(0, 10),
    period_end: addMonths(now, months).toISOString().slice(0, 10),
    calculated_at: Date.now(),
  };
}
