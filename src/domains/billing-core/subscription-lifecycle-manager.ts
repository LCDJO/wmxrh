/**
 * SubscriptionLifecycleManager — Orquestra lifecycle + billing side-effects
 *
 * Integra DiscountEngine para aplicar cupons em:
 * - Ativação de assinatura
 * - Upgrade de plano
 * - Renovação (processRenewal)
 */

import type { PlanLifecycleManagerAPI, PaymentPolicyEngineAPI } from '@/domains/platform-experience/types';
import type {
  SubscriptionLifecycleManagerAPI,
  BillingCalculatorAPI,
  InvoiceEngineAPI,
  FinancialLedgerAdapterAPI,
  DiscountEngineAPI,
  Invoice,
} from './types';
import type { BillingCycle } from '@/domains/platform-experience/types';
import { supabase } from '@/integrations/supabase/client';
import type { ModulePlanSyncAPI } from './module-plan-sync-service';
import { createPlanApplicationOrchestrator } from './plan-application-orchestrator';
import { emitBillingEvent } from './billing-events';

export function createSubscriptionLifecycleManager(
  planLifecycle: PlanLifecycleManagerAPI,
  calculator: BillingCalculatorAPI,
  invoices: InvoiceEngineAPI,
  ledger: FinancialLedgerAdapterAPI,
  paymentPolicy?: PaymentPolicyEngineAPI,
  modulePlanSync?: ModulePlanSyncAPI,
  discountEngine?: DiscountEngineAPI,
): SubscriptionLifecycleManagerAPI {
  const planOrchestrator = createPlanApplicationOrchestrator();

  /**
   * Helper: apply coupon or recurring discounts to a subtotal.
   * Returns { discountBrl, notes }.
   */
  async function resolveDiscount(
    tenantId: string,
    subtotalBrl: number,
    planId: string,
    billingCycle?: string,
    couponCode?: string,
  ): Promise<{ discountBrl: number; notes: string }> {
    if (!discountEngine) return { discountBrl: 0, notes: '' };

    // 1. Explicit coupon code
    if (couponCode) {
      const result = await discountEngine.applyDiscount(couponCode, tenantId, subtotalBrl, planId, billingCycle);
      if (result.applied) {
        return {
          discountBrl: result.discount_brl,
          notes: `Cupom ${result.coupon?.code ?? couponCode} aplicado: -R$${result.discount_brl.toFixed(2)}`,
        };
      }
    }

    // 2. Recurring discounts (active redemptions from prior coupons)
    const recurringDiscount = await discountEngine.calculateRecurringDiscount(tenantId, subtotalBrl);
    if (recurringDiscount > 0) {
      return {
        discountBrl: recurringDiscount,
        notes: `Desconto recorrente: -R$${recurringDiscount.toFixed(2)}`,
      };
    }

    return { discountBrl: 0, notes: '' };
  }

  return {
    async activate(tenantId, planId, cycle, couponCode?) {
      if (paymentPolicy) {
        paymentPolicy.getAllowedMethods(tenantId);
      }

      planLifecycle.transition(tenantId, 'activate', planId, 'Initial activation');
      const calc = calculator.calculateForPlan(tenantId, planId, cycle);

      // Apply discount
      const { discountBrl, notes: discountNotes } = await resolveDiscount(
        tenantId, calc.total_brl, planId, cycle, couponCode,
      );
      const finalAmount = Math.round(Math.max(0, calc.total_brl - discountBrl) * 100) / 100;

      const invoiceNotes = [`Ativação do plano — ${cycle}`, discountNotes].filter(Boolean).join(' | ');

      const invoice = await invoices.generate(tenantId, {
        tenant_id: tenantId,
        plan_id: planId,
        total_amount: finalAmount,
        billing_period_start: calc.period_start,
        billing_period_end: calc.period_end,
        due_date: calc.period_start,
        notes: invoiceNotes,
      });

      ledger.recordCharge(tenantId, invoice.id, finalAmount, `Fatura #${invoice.id.slice(0, 8)}`);

      if (discountBrl > 0) {
        ledger.recordCouponDiscount(tenantId, invoice.id, discountBrl, couponCode ?? 'recurring');
      }

      emitBillingEvent({
        type: 'SubscriptionCreated',
        timestamp: Date.now(),
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: cycle,
        trial_days: 0,
      });
      emitBillingEvent({
        type: 'InvoiceGenerated',
        timestamp: Date.now(),
        tenant_id: tenantId,
        invoice_id: invoice.id,
        total_amount: finalAmount,
        due_date: calc.period_start,
        notes: invoiceNotes,
      });

      modulePlanSync?.syncModulesForPlan(tenantId, planId);
      await planOrchestrator.applyPlanChange(tenantId, planId);
    },

    async upgrade(tenantId, toPlanId, couponCode?) {
      if (paymentPolicy) {
        const validation = paymentPolicy.validatePaymentMethod(tenantId, 'credit_card', toPlanId);
        if (!validation.valid) {
          throw new Error(`[Billing] Upgrade bloqueado: ${validation.reason}`);
        }
      }

      const snap = { plan_id: 'current' }; // simplified
      planLifecycle.transition(tenantId, 'upgrade', toPlanId, 'Plan upgrade');
      const proration = calculator.calculateProration(tenantId, snap.plan_id, toPlanId);

      if (proration.total_brl > 0) {
        // Apply discount to proration
        const { discountBrl, notes: discountNotes } = await resolveDiscount(
          tenantId, proration.total_brl, toPlanId, undefined, couponCode,
        );
        const finalAmount = Math.round(Math.max(0, proration.total_brl - discountBrl) * 100) / 100;

        const invoiceNotes = ['Upgrade proration', discountNotes].filter(Boolean).join(' | ');

        const invoice = await invoices.generate(tenantId, {
          tenant_id: tenantId,
          plan_id: toPlanId,
          total_amount: finalAmount,
          billing_period_start: proration.period_start,
          billing_period_end: proration.period_end,
          due_date: proration.period_start,
          notes: invoiceNotes,
        });
        ledger.recordCharge(tenantId, invoice.id, finalAmount, 'Proration charge');
        if (discountBrl > 0) {
          ledger.recordCouponDiscount(tenantId, invoice.id, discountBrl, couponCode ?? 'recurring');
        }

        emitBillingEvent({
          type: 'InvoiceGenerated',
          timestamp: Date.now(),
          tenant_id: tenantId,
          invoice_id: invoice.id,
          total_amount: finalAmount,
          due_date: proration.period_start,
          notes: invoiceNotes,
        });
        emitBillingEvent({
          type: 'RevenueUpdated',
          timestamp: Date.now(),
          tenant_id: tenantId,
          invoice_id: invoice.id,
          amount: finalAmount,
          entry_type: 'charge',
        });
      }

      emitBillingEvent({
        type: 'TenantPlanUpgraded',
        timestamp: Date.now(),
        tenant_id: tenantId,
        from_plan_id: snap.plan_id,
        to_plan_id: toPlanId,
        proration_amount: proration.total_brl,
      });

      modulePlanSync?.syncModulesForPlan(tenantId, toPlanId);

      // Apply all plan side-effects atomically
      await planOrchestrator.applyPlanChange(tenantId, toPlanId);
    },

    async downgrade(tenantId, toPlanId) {
      // Schedule downgrade for end of current cycle — never apply immediately
      planLifecycle.transition(tenantId, 'downgrade', toPlanId, 'Plan downgrade scheduled for cycle end');

      // Persist schedule in DB
      const { data: currentSub } = await supabase
        .from('tenant_plans')
        .select('id, plan_id, cycle_end_date')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle();

      if (currentSub) {
        await supabase
          .from('tenant_plans')
          .update({
            downgrade_scheduled: true,
            scheduled_plan_id: toPlanId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSub.id);

        emitBillingEvent({
          type: 'DowngradeScheduled',
          timestamp: Date.now(),
          tenant_id: tenantId,
          from_plan_id: currentSub.plan_id,
          to_plan_id: toPlanId,
          effective_date: currentSub.cycle_end_date ?? new Date().toISOString(),
        });
      }
    },

    async suspend(tenantId, reason) {
      planLifecycle.transition(tenantId, 'suspend', 'current', reason);
      modulePlanSync?.deactivateAllModules(tenantId);

      emitBillingEvent({
        type: 'SubscriptionSuspended',
        timestamp: Date.now(),
        tenant_id: tenantId,
        reason,
        grace_period_ended: true,
      });
    },

    async cancel(tenantId, reason) {
      planLifecycle.transition(tenantId, 'cancel', 'current', reason);
      modulePlanSync?.deactivateAllModules(tenantId);
    },

    async reactivate(tenantId) {
      planLifecycle.transition(tenantId, 'reactivate', 'current', 'Reactivation');
    },

    async processRenewal(tenantId, couponCode?): Promise<Invoice> {
      const calc = calculator.calculate(tenantId);

      // Apply coupon or recurring discount
      const { discountBrl, notes: discountNotes } = await resolveDiscount(
        tenantId, calc.total_brl, calc.plan_id, calc.billing_cycle, couponCode,
      );
      const finalAmount = Math.round(Math.max(0, calc.total_brl - discountBrl) * 100) / 100;

      const invoiceNotes = [`Renovação — ${calc.billing_cycle}`, discountNotes].filter(Boolean).join(' | ');

      const invoice = await invoices.generate(tenantId, {
        tenant_id: tenantId,
        plan_id: calc.plan_id,
        total_amount: finalAmount,
        billing_period_start: calc.period_start,
        billing_period_end: calc.period_end,
        due_date: calc.period_start,
        notes: invoiceNotes,
      });

      ledger.recordCharge(tenantId, invoice.id, finalAmount, `Renovação #${invoice.id.slice(0, 8)}`);
      if (discountBrl > 0) {
        ledger.recordCouponDiscount(tenantId, invoice.id, discountBrl, couponCode ?? 'recurring');
      }

      emitBillingEvent({
        type: 'InvoiceGenerated',
        timestamp: Date.now(),
        tenant_id: tenantId,
        invoice_id: invoice.id,
        total_amount: finalAmount,
        due_date: calc.period_start,
        notes: invoiceNotes,
      });
      emitBillingEvent({
        type: 'SubscriptionRenewed',
        timestamp: Date.now(),
        tenant_id: tenantId,
        plan_id: calc.plan_id,
        invoice_id: invoice.id,
        amount: finalAmount,
        next_billing_date: calc.period_end,
      });

      return invoice;
    },
  };
}
