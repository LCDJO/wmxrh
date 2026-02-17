/**
 * BillingCalculator — Calcula valores de cobrança por tenant/plano
 */

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

export function createBillingCalculator(
  planRegistry: PlanRegistryAPI,
  tenantPlan: TenantPlanResolverAPI
): BillingCalculatorAPI {
  function buildCalculation(
    tenantId: string,
    planId: string,
    cycle: BillingCycle,
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

    // Base plan
    items.push({
      description: `${plan.name} — ${cycle}`,
      quantity: months,
      unit_price_brl: monthlyRate,
      total_brl: monthlyRate * months,
      type: 'plan_base',
    });

    // Per-user pricing
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

    // Per-employee pricing
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

    // Setup fee (first invoice only)
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

    // Annual discount
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
      return buildCalculation(tenantId, snap.plan_id, snap.billing_cycle, {
        users: snap.usage.current_users,
        employees: snap.usage.current_employees,
      });
    },

    calculateForPlan(tenantId, planId, cycle) {
      const snap = tenantPlan.resolve(tenantId);
      return buildCalculation(tenantId, planId, cycle, {
        users: snap.usage.current_users,
        employees: snap.usage.current_employees,
      });
    },

    calculateProration(tenantId, fromPlanId, toPlanId) {
      const snap = tenantPlan.resolve(tenantId);
      const fromCalc = buildCalculation(tenantId, fromPlanId, snap.billing_cycle);
      const toCalc = buildCalculation(tenantId, toPlanId, snap.billing_cycle);
      const diff = toCalc.total_brl - fromCalc.total_brl;

      return {
        ...toCalc,
        line_items: [
          {
            description: `Proration: upgrade ${fromPlanId} → ${toPlanId}`,
            quantity: 1,
            unit_price_brl: diff,
            total_brl: diff,
            type: 'proration',
          },
        ],
        subtotal_brl: Math.max(0, diff),
        discount_brl: 0,
        total_brl: Math.max(0, diff),
      };
    },
  };
}
