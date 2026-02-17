/**
 * SubscriptionLifecycleManager — Orquestra lifecycle + billing side-effects
 */

import type { PlanLifecycleManagerAPI } from '@/domains/platform-experience/types';
import type {
  SubscriptionLifecycleManagerAPI,
  BillingCalculatorAPI,
  InvoiceEngineAPI,
  FinancialLedgerAdapterAPI,
  Invoice,
} from './types';
import type { BillingCycle } from '@/domains/platform-experience/types';

export function createSubscriptionLifecycleManager(
  planLifecycle: PlanLifecycleManagerAPI,
  calculator: BillingCalculatorAPI,
  invoices: InvoiceEngineAPI,
  ledger: FinancialLedgerAdapterAPI
): SubscriptionLifecycleManagerAPI {
  return {
    async activate(tenantId, planId, cycle) {
      planLifecycle.transition(tenantId, 'activate', planId, 'Initial activation');
      const calc = calculator.calculateForPlan(tenantId, planId, cycle);

      const invoice = await invoices.generate(tenantId, {
        tenant_id: tenantId,
        plan_id: planId,
        total_amount: calc.total_brl,
        billing_period_start: calc.period_start,
        billing_period_end: calc.period_end,
        due_date: calc.period_start,
        notes: `Ativação do plano — ${cycle}`,
      });

      ledger.recordCharge(tenantId, invoice.id, calc.total_brl, `Fatura #${invoice.id.slice(0, 8)}`);
    },

    async upgrade(tenantId, toPlanId) {
      const snap = { plan_id: 'current' }; // simplified
      planLifecycle.transition(tenantId, 'upgrade', toPlanId, 'Plan upgrade');
      const proration = calculator.calculateProration(tenantId, snap.plan_id, toPlanId);

      if (proration.total_brl > 0) {
        const invoice = await invoices.generate(tenantId, {
          tenant_id: tenantId,
          plan_id: toPlanId,
          total_amount: proration.total_brl,
          billing_period_start: proration.period_start,
          billing_period_end: proration.period_end,
          due_date: proration.period_start,
          notes: `Upgrade proration`,
        });
        ledger.recordCharge(tenantId, invoice.id, proration.total_brl, 'Proration charge');
      }
    },

    async downgrade(tenantId, toPlanId) {
      planLifecycle.transition(tenantId, 'downgrade', toPlanId, 'Plan downgrade (next cycle)');
    },

    async suspend(tenantId, reason) {
      planLifecycle.transition(tenantId, 'suspend', 'current', reason);
    },

    async cancel(tenantId, reason) {
      planLifecycle.transition(tenantId, 'cancel', 'current', reason);
    },

    async reactivate(tenantId) {
      planLifecycle.transition(tenantId, 'reactivate', 'current', 'Reactivation');
    },

    async processRenewal(tenantId): Promise<Invoice> {
      const calc = calculator.calculate(tenantId);

      const invoice = await invoices.generate(tenantId, {
        tenant_id: tenantId,
        plan_id: calc.plan_id,
        total_amount: calc.total_brl,
        billing_period_start: calc.period_start,
        billing_period_end: calc.period_end,
        due_date: calc.period_start,
        notes: `Renovação — ${calc.billing_cycle}`,
      });

      ledger.recordCharge(tenantId, invoice.id, calc.total_brl, `Renovação #${invoice.id.slice(0, 8)}`);
      return invoice;
    },
  };
}
