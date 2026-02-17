/**
 * ConversionMonitor — Monitors real-time conversion metrics per landing page version.
 *
 * Tracks:
 *  - LandingMetricEvent (page_view, cta_click, signup, revenue_generated, referral_*)
 *  - RevenueMetrics (revenue_per_visit, AOV, top sources)
 *  - ReferralConversions (referral click-through, conversion rate, revenue)
 *
 * Indicators:
 *  - conversion_rate
 *  - revenue_per_visit
 *  - cta_click_rate
 *  - signup_rate
 */
import { conversionTrackingService } from '../conversion-tracking-service';
import { referralTrackingService } from '../referral-tracking-service';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import type {
  ConversionSnapshot,
  ConversionIndicators,
  RevenueMetrics,
  ReferralConversionMetrics,
  LandingMetricEvent,
} from './types';

class ConversionMonitor {
  private snapshots = new Map<string, ConversionSnapshot[]>();
  private metricEvents = new Map<string, LandingMetricEvent[]>();
  private readonly MAX_SNAPSHOTS_PER_PAGE = 50;
  private readonly MAX_EVENTS_PER_PAGE = 500;

  // ── Event Ingestion ─────────────────────────────────

  /**
   * Ingest a raw metric event (called by conversion tracking hooks).
   */
  ingestEvent(event: Omit<LandingMetricEvent, 'id' | 'trackedAt'>): LandingMetricEvent {
    const full: LandingMetricEvent = {
      ...event,
      id: `lme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trackedAt: new Date().toISOString(),
    };

    const events = this.metricEvents.get(event.landingPageId) ?? [];
    events.push(full);
    if (events.length > this.MAX_EVENTS_PER_PAGE) events.splice(0, events.length - this.MAX_EVENTS_PER_PAGE);
    this.metricEvents.set(event.landingPageId, events);

    // Prometheus
    const mc = getMetricsCollector();
    mc.increment(`landing_metric_${event.type}_total`, { landing_page_id: event.landingPageId });

    return full;
  }

  // ── Snapshot Capture ─────────────────────────────────

  /**
   * Capture a full conversion snapshot for a landing page version.
   */
  capture(landingPageId: string, versionId: string, versionNumber: number): ConversionSnapshot {
    const funnel = conversionTrackingService.getConversionFunnel(landingPageId);
    const events = this.getVersionEvents(landingPageId, versionId);

    const impressions = funnel.views || 1;
    const signups = funnel.signups;
    const ctaClicks = events.filter(e => e.type === 'cta_click').length || funnel.referralClicks;
    const conversions = signups + funnel.trials + funnel.plansSelected;
    const conversionRate = this.pct(conversions, impressions);
    const bounceRate = this.pct(impressions - conversions, impressions);

    // KPI Indicators
    const indicators: ConversionIndicators = {
      conversion_rate: conversionRate,
      revenue_per_visit: impressions > 0 ? Math.round((funnel.totalRevenue / impressions) * 100) / 100 : 0,
      cta_click_rate: this.pct(ctaClicks, impressions),
      signup_rate: this.pct(signups, impressions),
    };

    // Revenue Metrics
    const revenueMetrics = this.buildRevenueMetrics(landingPageId, funnel.totalRevenue, impressions);

    // Referral Metrics
    const referralMetrics = this.buildReferralMetrics(landingPageId);

    const snapshot: ConversionSnapshot = {
      landingPageId,
      versionId,
      versionNumber,
      indicators,
      conversionRate,
      conversions,
      impressions,
      revenue: funnel.totalRevenue,
      bounceRate,
      revenueMetrics,
      referralMetrics,
      metricEvents: events,
      capturedAt: new Date().toISOString(),
    };

    this.store(landingPageId, snapshot);

    // Export indicators to Prometheus
    const mc = getMetricsCollector();
    const labels = { landing_page_id: landingPageId, version: String(versionNumber) };
    mc.gauge('landing_conversion_rate', indicators.conversion_rate, labels);
    mc.gauge('landing_revenue_per_visit', indicators.revenue_per_visit, labels);
    mc.gauge('landing_cta_click_rate', indicators.cta_click_rate, labels);
    mc.gauge('landing_signup_rate', indicators.signup_rate, labels);

    return snapshot;
  }

  // ── Queries ─────────────────────────────────────────

  getLatest(landingPageId: string): ConversionSnapshot | null {
    return (this.snapshots.get(landingPageId) ?? [])[0] ?? null;
  }

  getByVersion(landingPageId: string, versionId: string): ConversionSnapshot[] {
    return (this.snapshots.get(landingPageId) ?? []).filter(s => s.versionId === versionId);
  }

  getHistory(landingPageId: string): ConversionSnapshot[] {
    return this.snapshots.get(landingPageId) ?? [];
  }

  getLastPreviousVersionSnapshot(landingPageId: string, currentVersionId: string): ConversionSnapshot | null {
    return (this.snapshots.get(landingPageId) ?? []).find(s => s.versionId !== currentVersionId) ?? null;
  }

  /**
   * Get current indicators for a landing page (latest snapshot).
   */
  getIndicators(landingPageId: string): ConversionIndicators | null {
    return this.getLatest(landingPageId)?.indicators ?? null;
  }

  /**
   * Get raw metric events for a version.
   */
  getVersionEvents(landingPageId: string, versionId: string): LandingMetricEvent[] {
    return (this.metricEvents.get(landingPageId) ?? []).filter(e => e.versionId === versionId);
  }

  // ── Revenue Metrics Builder ─────────────────────────

  private buildRevenueMetrics(landingPageId: string, totalRevenue: number, impressions: number): RevenueMetrics {
    const allEvents = conversionTrackingService.getByPage(landingPageId);
    const revenueEvents = allEvents.filter(e => e.type === 'revenue_generated');

    // Top sources by revenue
    const sourceRevenue = new Map<string, number>();
    for (const ev of revenueEvents) {
      sourceRevenue.set(ev.source, (sourceRevenue.get(ev.source) ?? 0) + (ev.revenue ?? 0));
    }

    return {
      totalRevenue,
      revenuePerVisit: impressions > 0 ? Math.round((totalRevenue / impressions) * 100) / 100 : 0,
      averageOrderValue: revenueEvents.length > 0 ? Math.round((totalRevenue / revenueEvents.length) * 100) / 100 : 0,
      revenueEvents: revenueEvents.length,
      topSources: Array.from(sourceRevenue.entries())
        .map(([source, revenue]) => ({ source, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }

  // ── Referral Metrics Builder ────────────────────────

  private buildReferralMetrics(landingPageId: string): ReferralConversionMetrics {
    const allEvents = conversionTrackingService.getByPage(landingPageId);
    const referralClicks = allEvents.filter(e => e.type === 'referral_click');
    const referralConversions = allEvents.filter(
      e => e.referralCode && ['tenant_created', 'plan_selected', 'revenue_generated'].includes(e.type),
    );

    // Top referral codes
    const codeStats = new Map<string, { conversions: number; revenue: number }>();
    for (const ev of allEvents.filter(e => e.referralCode)) {
      const stats = codeStats.get(ev.referralCode!) ?? { conversions: 0, revenue: 0 };
      if (['tenant_created', 'plan_selected', 'revenue_generated'].includes(ev.type)) {
        stats.conversions++;
      }
      stats.revenue += ev.revenue ?? 0;
      codeStats.set(ev.referralCode!, stats);
    }

    const referralRevenue = referralConversions.reduce((s, e) => s + (e.revenue ?? 0), 0);

    return {
      totalReferralClicks: referralClicks.length,
      totalReferralConversions: referralConversions.length,
      referralConversionRate: referralClicks.length > 0
        ? Math.round((referralConversions.length / referralClicks.length) * 10000) / 100
        : 0,
      referralRevenue,
      topReferralCodes: Array.from(codeStats.entries())
        .map(([code, stats]) => ({ code, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  }

  // ── Internals ───────────────────────────────────────

  private store(landingPageId: string, snapshot: ConversionSnapshot): void {
    const history = this.snapshots.get(landingPageId) ?? [];
    history.unshift(snapshot);
    if (history.length > this.MAX_SNAPSHOTS_PER_PAGE) history.length = this.MAX_SNAPSHOTS_PER_PAGE;
    this.snapshots.set(landingPageId, history);
  }

  private pct(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 100;
  }
}

export const conversionMonitor = new ConversionMonitor();
export { ConversionMonitor };
