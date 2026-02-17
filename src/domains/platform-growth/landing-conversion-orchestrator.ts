/**
 * LandingConversionOrchestrator
 *
 * Orquestra o fluxo completo de conversão via Landing Page:
 *
 *  1. ReferralEvent       → registra atribuição de indicação (se houver ?ref=CODE)
 *  2. Tenant Creation     → cria tenant via tenantService
 *  3. Coupon Application  → aplica cupom (se houver) via CouponValidation + Discount
 *  4. Revenue Registration→ registra receita no Financial Ledger + emite eventos
 *
 * Cada passo emite eventos de domínio para auditoria e downstream consumers
 * (gamificação, observabilidade, dashboards financeiros).
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  LP Visit (?ref=CODE&coupon=SAVE20)                  ║
 * ║   │                                                   ║
 * ║   ▼                                                   ║
 * ║  1. trackReferralClick (ConversionTrackingService)    ║
 * ║   │                                                   ║
 * ║   ▼                                                   ║
 * ║  2. createTenant (tenantService)                      ║
 * ║   │                                                   ║
 * ║   ▼                                                   ║
 * ║  3. validateAndApplyCoupon (CouponDiscountEngine)     ║
 * ║   │                                                   ║
 * ║   ▼                                                   ║
 * ║  4. recordRevenue (FinancialLedger)                   ║
 * ║   │                                                   ║
 * ║   ▼                                                   ║
 * ║  5. issueReferralReward (RewardCalculator)            ║
 * ╚══════════════════════════════════════════════════════╝
 */

import { conversionTrackingService } from './conversion-tracking-service';
import { referralTrackingService } from './referral-tracking-service';
import { emitGrowthEvent } from './growth.events';
import { createFinancialLedgerAdapter } from '@/domains/billing-core/financial-ledger-adapter';
import { tenantService } from '@/domains/tenant/tenant.service';
import type { ConversionEvent } from './types';

// ── Types ────────────────────────────────────────────────────────

export interface LandingConversionInput {
  /** Landing page that originated the conversion */
  landingPageId: string;

  /** Tenant data */
  tenantName: string;
  tenantDocument?: string;
  tenantEmail?: string;
  tenantPhone?: string;

  /** Plan selected */
  planId: string;
  planName: string;
  planPrice: number; // BRL

  /** Optional referral code (?ref=CODE) */
  referralCode?: string | null;

  /** Optional coupon code (?coupon=CODE) */
  couponCode?: string | null;

  /** Source attribution */
  source?: string;
}

export interface LandingConversionResult {
  success: boolean;
  tenantId: string | null;
  events: ConversionEvent[];
  couponApplied: boolean;
  discountAmount: number;
  finalPrice: number;
  referralAttributed: boolean;
  error?: string;
}

// ── Orchestrator ──────────────────────────────────────────────────

export class LandingConversionOrchestrator {
  private ledger = createFinancialLedgerAdapter();

  /**
   * Execute the full conversion pipeline.
   *
   * Each step is idempotent-safe — if a downstream step fails,
   * earlier events are preserved for debugging / retry.
   */
  async execute(input: LandingConversionInput): Promise<LandingConversionResult> {
    const events: ConversionEvent[] = [];
    const source = input.referralCode ? 'referral' : (input.source ?? 'organic');

    try {
      // ── Step 1: Referral click attribution ──
      let referralAttributed = false;
      if (input.referralCode) {
        const clickEvent = referralTrackingService.trackReferralEvent(
          input.landingPageId,
          input.referralCode,
          'referral_click',
        );
        events.push(clickEvent);
        referralAttributed = true;
      }

      // ── Step 2: Create Tenant ──
      const tenant = await tenantService.create({
        name: input.tenantName,
        document: input.tenantDocument,
      });

      if (!tenant?.id) {
        return { success: false, tenantId: null, events, couponApplied: false, discountAmount: 0, finalPrice: input.planPrice, referralAttributed, error: 'Falha ao criar tenant' };
      }

      const tenantId = tenant.id;

      // Track tenant_created
      const tenantEvent = conversionTrackingService.track({
        landingPageId: input.landingPageId,
        type: 'tenant_created',
        source,
        referralCode: input.referralCode ?? undefined,
        tenantId,
        metadata: { tenantName: input.tenantName },
      });
      events.push(tenantEvent);

      // Track plan_selected
      const planEvent = conversionTrackingService.track({
        landingPageId: input.landingPageId,
        type: 'plan_selected',
        source,
        referralCode: input.referralCode ?? undefined,
        tenantId,
        planSelected: input.planId,
        metadata: { planName: input.planName, planPrice: input.planPrice },
      });
      events.push(planEvent);

      // ── Step 3: Validate & Apply Coupon ──
      let couponApplied = false;
      let discountAmount = 0;
      let finalPrice = input.planPrice;

      if (input.couponCode) {
        try {
          const { createDiscountEngine } = await import('@/domains/billing-core/coupon-discount-engine');
          const discount = createDiscountEngine();

          const application = await discount.applyDiscount(
            input.couponCode,
            tenantId,
            input.planPrice,
            input.planId,
          );

          if (application.applied) {
            discountAmount = application.discount_brl;
            finalPrice = application.final_amount_brl;
            couponApplied = true;

            // Record coupon discount in ledger
            await this.ledger.recordCouponDiscount(
              tenantId,
              '', // no invoice yet
              discountAmount,
              input.couponCode,
            );
          }
        } catch (err) {
          console.warn('[LandingConversionOrchestrator] Coupon application failed:', err);
          // Conversion continues without coupon — non-blocking
        }
      }

      // ── Step 4: Register Revenue ──
      const revenueEvent = conversionTrackingService.track({
        landingPageId: input.landingPageId,
        type: 'revenue_generated',
        source,
        referralCode: input.referralCode ?? undefined,
        tenantId,
        revenue: finalPrice,
        metadata: {
          planName: input.planName,
          grossPrice: input.planPrice,
          discount: discountAmount,
          couponCode: input.couponCode,
        },
      });
      events.push(revenueEvent);

      // Record plan charge in ledger
      await this.ledger.recordPlanCharge(tenantId, '', finalPrice, input.planName);

      // ── Step 5: Issue Referral Reward (if applicable) ──
      if (input.referralCode && finalPrice > 0) {
        try {
          const { createRewardCalculator } = await import('@/domains/revenue-intelligence/revenue-intelligence-engine');
          const rewards = createRewardCalculator();

          // Determine referrer tier (default to bronze for new referrals)
          await rewards.issueReward(
            '', // referrerUserId — resolved by RewardCalculator via referral_links
            tenantId,
            finalPrice,
            'bronze',
            'credit',
            '', // trackingId
          );
        } catch (err) {
          console.warn('[LandingConversionOrchestrator] Referral reward failed:', err);
          // Non-blocking — reward can be issued later
        }
      }

      // ── Emit completion event ──
      emitGrowthEvent({
        type: 'ConversionTracked',
        timestamp: Date.now(),
        pageId: input.landingPageId,
        conversionType: 'full_conversion',
        source,
        referralCode: input.referralCode ?? undefined,
        tenantId,
        revenue: finalPrice,
      });

      return {
        success: true,
        tenantId,
        events,
        couponApplied,
        discountAmount,
        finalPrice,
        referralAttributed,
      };
    } catch (err) {
      console.error('[LandingConversionOrchestrator] Pipeline failed:', err);
      return {
        success: false,
        tenantId: null,
        events,
        couponApplied: false,
        discountAmount: 0,
        finalPrice: input.planPrice,
        referralAttributed: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract conversion params from the current URL (used by LP renderer).
   */
  extractParamsFromURL(): { referralCode: string | null; couponCode: string | null } {
    const params = new URLSearchParams(window.location.search);
    return {
      referralCode: params.get('ref'),
      couponCode: params.get('coupon'),
    };
  }
}

export const landingConversionOrchestrator = new LandingConversionOrchestrator();
