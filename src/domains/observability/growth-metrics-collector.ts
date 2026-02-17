/**
 * GrowthMetricsCollector — Prometheus-compatible metrics for landing pages,
 * conversions, FAB clicks, and revenue attribution.
 *
 * Metrics exported:
 *   landing_page_views_total       (counter, labels: page)
 *   landing_conversion_total       (counter, labels: page, type)
 *   fab_cta_click_total            (counter, labels: page, section)
 *   revenue_by_landing             (gauge,   labels: page)
 */
import { getMetricsCollector } from './metrics-collector';
import { landingPageBuilder } from '@/domains/platform-growth';
import { conversionTrackingService } from '@/domains/platform-growth';

// ── Instrument helpers (called from UI / services) ────────────

export function recordPageView(page: string) {
  getMetricsCollector().increment('landing_page_views_total', { page });
}

export function recordConversion(page: string, type: string) {
  getMetricsCollector().increment('landing_conversion_total', { page, type });
}

export function recordFABClick(page: string, section: string) {
  getMetricsCollector().increment('fab_cta_click_total', { page, section });
}

export function recordLandingRevenue(page: string, amount: number) {
  getMetricsCollector().gauge('revenue_by_landing', amount, { page });
}

// ── Snapshot — Syncs current state into the collector ──────────

export interface GrowthMetricsSnapshot {
  landing_page_views_total: Array<{ page: string; value: number }>;
  landing_conversion_total: Array<{ page: string; type: string; value: number }>;
  fab_cta_click_total: Array<{ page: string; section: string; value: number }>;
  revenue_by_landing: Array<{ page: string; value: number }>;
}

export async function collectGrowthMetrics(): Promise<GrowthMetricsSnapshot> {
  const collector = getMetricsCollector();
  const pages = await landingPageBuilder.getAll();

  const snapshot: GrowthMetricsSnapshot = {
    landing_page_views_total: [],
    landing_conversion_total: [],
    fab_cta_click_total: [],
    revenue_by_landing: [],
  };

  for (const page of pages) {
    const slug = page.slug;

    // Views
    collector.gauge('landing_page_views_total', page.analytics.views, { page: slug });
    snapshot.landing_page_views_total.push({ page: slug, value: page.analytics.views });

    // Conversions
    collector.gauge('landing_conversion_total', page.analytics.conversions, { page: slug, type: 'all' });
    snapshot.landing_conversion_total.push({ page: slug, type: 'all', value: page.analytics.conversions });

    // Funnel breakdown
    const funnel = conversionTrackingService.getConversionFunnel(page.id);
    for (const [type, value] of Object.entries({
      signup: funnel.signups,
      trial_start: funnel.trials,
      tenant_created: funnel.tenantsCreated,
      plan_selected: funnel.plansSelected,
      revenue_generated: funnel.revenueEvents,
    })) {
      collector.gauge('landing_conversion_total', value, { page: slug, type });
      snapshot.landing_conversion_total.push({ page: slug, type, value });
    }

    // FAB CTA clicks (per block type)
    for (const block of page.blocks) {
      collector.gauge('fab_cta_click_total', 0, { page: slug, section: block.type });
      snapshot.fab_cta_click_total.push({ page: slug, section: block.type, value: 0 });
    }

    // Revenue
    collector.gauge('revenue_by_landing', funnel.totalRevenue, { page: slug });
    snapshot.revenue_by_landing.push({ page: slug, value: funnel.totalRevenue });
  }

  return snapshot;
}
