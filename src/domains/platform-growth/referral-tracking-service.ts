/**
 * ReferralTrackingService — Bridges landing page ?ref=CODE with ReferralManager.
 *
 * Responsibilities:
 *  1. Resolve referral code from URL params
 *  2. Attribute conversions (signup → tenant_created → plan_selected → revenue) to the referrer
 *  3. Trigger gamification rewards via Revenue Intelligence layer
 */
import { conversionTrackingService } from './conversion-tracking-service';
import type { ConversionEvent } from './types';

export interface ReferralAttribution {
  referralCode: string;
  landingPageId: string;
  referrerUserId?: string;
  events: ConversionEvent[];
  totalRevenue: number;
  conversionComplete: boolean;
}

export class ReferralTrackingService {
  /**
   * Extract ?ref=CODE from current URL
   */
  extractCodeFromURL(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') ?? null;
  }

  /**
   * Track a referral-attributed event on the landing page.
   * Wraps ConversionTrackingService with referral context.
   */
  trackReferralEvent(
    landingPageId: string,
    referralCode: string,
    type: ConversionEvent['type'],
    extra: Partial<Pick<ConversionEvent, 'tenantId' | 'planSelected' | 'revenue'>> = {},
  ): ConversionEvent {
    return conversionTrackingService.track({
      landingPageId,
      type,
      source: 'referral',
      referralCode,
      tenantId: extra.tenantId,
      planSelected: extra.planSelected,
      revenue: extra.revenue,
      metadata: { attribution: 'referral', code: referralCode },
    });
  }

  /**
   * Build the full attribution chain for a referral code on a given page.
   * A conversion is "complete" when tenant_created + plan_selected + revenue_generated all exist.
   */
  getAttribution(referralCode: string, landingPageId?: string): ReferralAttribution {
    const allEvents = conversionTrackingService.getAll();

    const events = allEvents.filter(
      (e) =>
        e.referralCode === referralCode &&
        (!landingPageId || e.landingPageId === landingPageId),
    );

    const hasTypes = (types: ConversionEvent['type'][]) =>
      types.every((t) => events.some((e) => e.type === t));

    return {
      referralCode,
      landingPageId: landingPageId ?? events[0]?.landingPageId ?? '',
      events,
      totalRevenue: events.reduce((sum, e) => sum + (e.revenue ?? 0), 0),
      conversionComplete: hasTypes(['tenant_created', 'plan_selected', 'revenue_generated']),
    };
  }

  /**
   * Get all referral codes that have generated at least one event.
   */
  getActiveReferrals(): ReferralAttribution[] {
    const allEvents = conversionTrackingService.getAll();
    const codes = new Set(allEvents.filter((e) => e.referralCode).map((e) => e.referralCode!));

    return Array.from(codes).map((code) => this.getAttribution(code));
  }

  /**
   * Summary metrics across all referral conversions.
   */
  getSummary() {
    const attributions = this.getActiveReferrals();
    return {
      totalReferrals: attributions.length,
      completedConversions: attributions.filter((a) => a.conversionComplete).length,
      pendingConversions: attributions.filter((a) => !a.conversionComplete).length,
      totalRevenue: attributions.reduce((sum, a) => sum + a.totalRevenue, 0),
      topReferrals: attributions
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10),
    };
  }
}

export const referralTrackingService = new ReferralTrackingService();
