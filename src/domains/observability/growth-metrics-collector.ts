/**
 * GrowthMetricsCollector — Prometheus-compatible metrics for landing pages,
 * conversions, FAB clicks, AI headlines, revenue attribution, and smart rollback.
 *
 * Metrics exported:
 *   website_page_views_total          (counter, labels: page)
 *   landing_conversion_rate           (gauge,   labels: page)
 *   ai_generated_headlines_total      (counter, labels: page, tone)
 *   fab_section_click_rate            (gauge,   labels: page, section)
 *
 *   landing_rollback_triggered_total  (counter, labels: landing, mode)
 *   landing_performance_drop_score    (gauge,   labels: landing)
 *   rollback_success_rate             (gauge,   global)
 *
 *   growth_ai_suggestions_total       (counter, labels: type)
 *   growth_ai_acceptance_rate         (gauge,   global)
 *   growth_ai_conversion_gain_estimate (gauge,  global)
 *
 * Legacy metrics (kept for backward compat):
 *   landing_page_views_total          (counter, labels: page)
 *   landing_conversion_total          (counter, labels: page, type)
 *   fab_cta_click_total               (counter, labels: page, section)
 *   revenue_by_landing                (gauge,   labels: page)
 */
import { getMetricsCollector } from './metrics-collector';
import { landingPageBuilder } from '@/domains/platform-growth';
import { conversionTrackingService } from '@/domains/platform-growth';

// ═══════════════════════════════════════════════════════════════
// Instrument helpers (called from UI / services)
// ═══════════════════════════════════════════════════════════════

/** Increment website_page_views_total counter */
export function recordPageView(page: string) {
  getMetricsCollector().increment('website_page_views_total', { page });
  // Legacy alias
  getMetricsCollector().increment('landing_page_views_total', { page });
}

/** Record a conversion event (updates rate automatically on next snapshot) */
export function recordConversion(page: string, type: string) {
  getMetricsCollector().increment('landing_conversion_total', { page, type });
}

/** Record a FAB section click (updates rate automatically on next snapshot) */
export function recordFABClick(page: string, section: string) {
  getMetricsCollector().increment('fab_cta_click_total', { page, section });
}

/** Record an AI-generated headline */
export function recordAIHeadline(page: string, tone: string) {
  getMetricsCollector().increment('ai_generated_headlines_total', { page, tone });
}

export function recordLandingRevenue(page: string, amount: number) {
  getMetricsCollector().gauge('revenue_by_landing', amount, { page });
}

// ═══════════════════════════════════════════════════════════════
// Smart Rollback metrics
// ═══════════════════════════════════════════════════════════════

/** Record a rollback trigger event */
export function recordRollbackTriggered(landing: string, mode: 'automatic' | 'manual' | 'suggested') {
  getMetricsCollector().increment('landing_rollback_triggered_total', { landing, mode });
}

/** Record performance drop score for a landing page (0-100, higher = worse) */
export function recordPerformanceDropScore(landing: string, score: number) {
  getMetricsCollector().gauge('landing_performance_drop_score', score, { landing });
}

/** Update global rollback success rate (completed / total triggered * 100) */
export function updateRollbackSuccessRate(completed: number, total: number) {
  const rate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 100;
  getMetricsCollector().gauge('rollback_success_rate', rate);
}

// ═══════════════════════════════════════════════════════════════
// GrowthAI Observability metrics
// ═══════════════════════════════════════════════════════════════

const aiSuggestionAccumulator = { total: 0, accepted: 0, conversionGainEstimate: 0 };

/** Record a GrowthAI suggestion generated */
export function recordAISuggestion(type: 'headline' | 'fab' | 'layout' | 'experiment') {
  aiSuggestionAccumulator.total += 1;
  getMetricsCollector().increment('growth_ai_suggestions_total', { type });
}

/** Record acceptance of a GrowthAI suggestion */
export function recordAISuggestionAccepted(type: 'headline' | 'fab' | 'layout' | 'experiment') {
  aiSuggestionAccumulator.accepted += 1;
  getMetricsCollector().increment('growth_ai_suggestions_accepted_total', { type });
  // Update acceptance rate gauge
  const rate = aiSuggestionAccumulator.total > 0
    ? Math.round((aiSuggestionAccumulator.accepted / aiSuggestionAccumulator.total) * 10000) / 100
    : 0;
  getMetricsCollector().gauge('growth_ai_acceptance_rate', rate);
}

/** Record estimated conversion gain from AI suggestions (cumulative %) */
export function recordAIConversionGainEstimate(estimatedGainPct: number) {
  aiSuggestionAccumulator.conversionGainEstimate += estimatedGainPct;
  getMetricsCollector().gauge('growth_ai_conversion_gain_estimate', aiSuggestionAccumulator.conversionGainEstimate);
}

/** Get current AI suggestion accumulator snapshot */
export function getAISuggestionStats() {
  return { ...aiSuggestionAccumulator };
}

// ═══════════════════════════════════════════════════════════════
// In-memory accumulators for rate calculation
// ═══════════════════════════════════════════════════════════════

const fabClickAccumulator = new Map<string, number>(); // "page|section" → clicks
const fabViewAccumulator = new Map<string, number>();  // "page|section" → views
const aiHeadlineAccumulator = new Map<string, number>(); // "page|tone" → count

/** Record a FAB section impression (used to compute click rate) */
export function recordFABImpression(page: string, section: string) {
  const key = `${page}|${section}`;
  fabViewAccumulator.set(key, (fabViewAccumulator.get(key) ?? 0) + 1);
}

/** Increment FAB click for rate calculation */
export function recordFABClickForRate(page: string, section: string) {
  const key = `${page}|${section}`;
  fabClickAccumulator.set(key, (fabClickAccumulator.get(key) ?? 0) + 1);
  recordFABClick(page, section);
}

/** Increment AI headline counter for accumulator */
export function recordAIHeadlineForAccumulator(page: string, tone: string) {
  const key = `${page}|${tone}`;
  aiHeadlineAccumulator.set(key, (aiHeadlineAccumulator.get(key) ?? 0) + 1);
  recordAIHeadline(page, tone);
}

// ═══════════════════════════════════════════════════════════════
// Snapshot — Syncs current state into the collector
// ═══════════════════════════════════════════════════════════════

export interface GrowthMetricsSnapshot {
  // New primary metrics
  website_page_views_total: Array<{ page: string; value: number }>;
  landing_conversion_rate: Array<{ page: string; value: number }>;
  ai_generated_headlines_total: Array<{ page: string; tone: string; value: number }>;
  fab_section_click_rate: Array<{ page: string; section: string; value: number }>;

  // GrowthAI metrics
  growth_ai_suggestions_total: number;
  growth_ai_acceptance_rate: number;
  growth_ai_conversion_gain_estimate: number;

  // Legacy
  landing_page_views_total: Array<{ page: string; value: number }>;
  landing_conversion_total: Array<{ page: string; type: string; value: number }>;
  fab_cta_click_total: Array<{ page: string; section: string; value: number }>;
  revenue_by_landing: Array<{ page: string; value: number }>;
}

export async function collectGrowthMetrics(): Promise<GrowthMetricsSnapshot> {
  const collector = getMetricsCollector();
  const pages = await landingPageBuilder.getAll();

  const snapshot: GrowthMetricsSnapshot = {
    website_page_views_total: [],
    landing_conversion_rate: [],
    ai_generated_headlines_total: [],
    fab_section_click_rate: [],
    growth_ai_suggestions_total: aiSuggestionAccumulator.total,
    growth_ai_acceptance_rate: aiSuggestionAccumulator.total > 0
      ? Math.round((aiSuggestionAccumulator.accepted / aiSuggestionAccumulator.total) * 10000) / 100
      : 0,
    growth_ai_conversion_gain_estimate: aiSuggestionAccumulator.conversionGainEstimate,
    landing_page_views_total: [],
    landing_conversion_total: [],
    fab_cta_click_total: [],
    revenue_by_landing: [],
  };

  for (const page of pages) {
    const slug = page.slug;
    const funnel = conversionTrackingService.getConversionFunnel(page.id);

    // ── website_page_views_total ──
    collector.gauge('website_page_views_total', page.analytics.views, { page: slug });
    snapshot.website_page_views_total.push({ page: slug, value: page.analytics.views });

    // ── landing_conversion_rate (conversions / views * 100) ──
    const convRate = page.analytics.views > 0
      ? Math.round((page.analytics.conversions / page.analytics.views) * 10000) / 100
      : 0;
    collector.gauge('landing_conversion_rate', convRate, { page: slug });
    snapshot.landing_conversion_rate.push({ page: slug, value: convRate });

    // ── ai_generated_headlines_total (from accumulator) ──
    for (const [key, count] of aiHeadlineAccumulator.entries()) {
      const [p, tone] = key.split('|');
      if (p === slug) {
        collector.gauge('ai_generated_headlines_total', count, { page: slug, tone });
        snapshot.ai_generated_headlines_total.push({ page: slug, tone, value: count });
      }
    }

    // ── fab_section_click_rate (clicks / impressions * 100) ──
    for (const block of page.blocks) {
      const key = `${slug}|${block.type}`;
      const clicks = fabClickAccumulator.get(key) ?? 0;
      const views = fabViewAccumulator.get(key) ?? Math.max(page.analytics.views, 1);
      const clickRate = views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0;

      collector.gauge('fab_section_click_rate', clickRate, { page: slug, section: block.type });
      snapshot.fab_section_click_rate.push({ page: slug, section: block.type, value: clickRate });
    }

    // ── Legacy metrics (preserved) ──
    collector.gauge('landing_page_views_total', page.analytics.views, { page: slug });
    snapshot.landing_page_views_total.push({ page: slug, value: page.analytics.views });

    collector.gauge('landing_conversion_total', page.analytics.conversions, { page: slug, type: 'all' });
    snapshot.landing_conversion_total.push({ page: slug, type: 'all', value: page.analytics.conversions });

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

    for (const block of page.blocks) {
      collector.gauge('fab_cta_click_total', 0, { page: slug, section: block.type });
      snapshot.fab_cta_click_total.push({ page: slug, section: block.type, value: 0 });
    }

    collector.gauge('revenue_by_landing', funnel.totalRevenue, { page: slug });
    snapshot.revenue_by_landing.push({ page: slug, value: funnel.totalRevenue });
  }

  return snapshot;
}
