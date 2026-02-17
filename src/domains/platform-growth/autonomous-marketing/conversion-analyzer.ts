/**
 * ConversionAnalyzer — Statistical analysis + KPI calculators.
 *
 * Core KPIs:
 *  - ConversionRate (signup_completed / page_view)
 *  - RevenuePerVisitor (total revenue / unique visitors)
 *  - CTR (cta_click / page_view)
 *  - FAB Engagement Score (weighted composite of scroll + cta + signup_started)
 */
import type { ABExperiment, ABVariant, ConversionFunnel, FunnelStep, ExperimentId, ConversionDataPoint } from './types';
import { abTestingManager } from './ab-testing-manager';
import { conversionMetricsCollector } from './conversion-metrics-collector';

// ── KPI Result Types ──

export interface ConversionKPIs {
  conversionRate: number;        // %
  revenuePerVisitor: number;     // R$
  ctr: number;                   // %
  fabEngagementScore: number;    // 0-100
  pageViews: number;
  uniqueVisitors: number;
  totalRevenue: number;
  ctaClicks: number;
  signupsStarted: number;
  signupsCompleted: number;
}

export interface VariantKPIs extends ConversionKPIs {
  variantId: string;
  variantName: string;
}

class ConversionAnalyzer {

  // ══════════════════════════════════════════════
  //  KPI CALCULATORS
  // ══════════════════════════════════════════════

  /** Calculate all KPIs for a landing page */
  calculateKPIs(landingPageId: string, since?: string): ConversionKPIs {
    const points = conversionMetricsCollector.getByLandingPage(landingPageId, since);
    return this.computeKPIs(points);
  }

  /** Calculate KPIs per variant for an experiment */
  calculateVariantKPIs(experimentId: ExperimentId): VariantKPIs[] {
    const exp = abTestingManager.getExperiment(experimentId);
    const allPoints = conversionMetricsCollector.getByExperiment(experimentId);

    return exp.variants.map(variant => {
      const variantPoints = allPoints.filter(p => p.variantId === variant.id);
      const kpis = this.computeKPIs(variantPoints);
      return { ...kpis, variantId: variant.id, variantName: variant.name };
    });
  }

  /** ConversionRate = signup_completed / page_view × 100 */
  calcConversionRate(points: ConversionDataPoint[]): number {
    const views = points.filter(p => p.metricType === 'page_view').length;
    const conversions = points.filter(p => p.metricType === 'signup_completed').length;
    return views > 0 ? Math.round((conversions / views) * 10000) / 100 : 0;
  }

  /** RevenuePerVisitor = sum(revenue_generated.value) / unique visitors */
  calcRevenuePerVisitor(points: ConversionDataPoint[]): number {
    const uniqueVisitors = new Set(points.map(p => p.visitorId)).size;
    const totalRevenue = points
      .filter(p => p.metricType === 'revenue_generated')
      .reduce((sum, p) => sum + p.value, 0);
    return uniqueVisitors > 0 ? Math.round((totalRevenue / uniqueVisitors) * 100) / 100 : 0;
  }

  /** CTR = cta_click / page_view × 100 */
  calcCTR(points: ConversionDataPoint[]): number {
    const views = points.filter(p => p.metricType === 'page_view').length;
    const clicks = points.filter(p => p.metricType === 'cta_click').length;
    return views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0;
  }

  /**
   * FAB Engagement Score (0-100)
   *
   * Weighted composite:
   *  - scroll_depth events  → 30% (measures content consumption)
   *  - cta_click events     → 40% (measures interest/action)
   *  - signup_started events → 30% (measures intent)
   *
   * Normalized against page_view count.
   */
  calcFABEngagementScore(points: ConversionDataPoint[]): number {
    const views = points.filter(p => p.metricType === 'page_view').length;
    if (views === 0) return 0;

    const scrolls = points.filter(p => p.metricType === 'scroll_depth').length;
    const clicks = points.filter(p => p.metricType === 'cta_click').length;
    const starts = points.filter(p => p.metricType === 'signup_started').length;

    // Rates capped at 1.0 (100%)
    const scrollRate = Math.min(1, scrolls / views);
    const clickRate = Math.min(1, clicks / views);
    const startRate = Math.min(1, starts / views);

    const raw = scrollRate * 30 + clickRate * 40 + startRate * 30;
    return Math.round(Math.min(100, raw) * 100) / 100;
  }

  // ══════════════════════════════════════════════
  //  A/B STATISTICAL ANALYSIS
  // ══════════════════════════════════════════════

  /** Calculate statistical significance between control and a variant */
  calculateSignificance(experimentId: ExperimentId, variantId: string): {
    zScore: number;
    pValue: number;
    confidence: number;
    significant: boolean;
    lift: number;
  } {
    const exp = abTestingManager.getExperiment(experimentId);
    const control = exp.variants.find(v => v.isControl);
    const variant = exp.variants.find(v => v.id === variantId);

    if (!control || !variant) throw new Error('Control or variant not found');

    const { conversionRate: pC, impressions: nC } = control.metrics;
    const { conversionRate: pV, impressions: nV } = variant.metrics;

    if (nC === 0 || nV === 0) {
      return { zScore: 0, pValue: 1, confidence: 0, significant: false, lift: 0 };
    }

    const pcDec = pC / 100;
    const pvDec = pV / 100;
    const pooled = (pcDec * nC + pvDec * nV) / (nC + nV);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / nC + 1 / nV));

    const zScore = se > 0 ? (pvDec - pcDec) / se : 0;
    const pValue = this.zToPValue(Math.abs(zScore));
    const confidence = Math.round((1 - pValue) * 10000) / 100;
    const lift = pcDec > 0 ? Math.round(((pvDec - pcDec) / pcDec) * 10000) / 100 : 0;

    variant.metrics.confidenceVsControl = confidence;

    return {
      zScore: Math.round(zScore * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      confidence,
      significant: confidence >= exp.confidenceLevel,
      lift,
    };
  }

  /** Analyze all variants in an experiment */
  analyzeExperiment(experimentId: ExperimentId): {
    experiment: ABExperiment;
    kpiComparison: VariantKPIs[];
    results: Array<{
      variant: ABVariant;
      lift: number;
      confidence: number;
      significant: boolean;
      recommendation: string;
    }>;
    suggestedWinner: string | null;
  } {
    const exp = abTestingManager.getExperiment(experimentId);
    const kpiComparison = this.calculateVariantKPIs(experimentId);

    const results = exp.variants
      .filter(v => !v.isControl)
      .map(v => {
        const analysis = this.calculateSignificance(experimentId, v.id);
        let recommendation = 'Continue collecting data';
        if (analysis.significant && analysis.lift > 0) recommendation = 'Strong winner — consider completing experiment';
        else if (analysis.significant && analysis.lift < 0) recommendation = 'Underperforming — consider removing variant';
        else if (v.metrics.impressions >= exp.minSampleSize) recommendation = 'Sufficient data — no significant difference';

        return { variant: v, lift: analysis.lift, confidence: analysis.confidence, significant: analysis.significant, recommendation };
      });

    const significantWinners = results.filter(r => r.significant && r.lift > 0).sort((a, b) => b.lift - a.lift);

    return {
      experiment: exp,
      kpiComparison,
      results,
      suggestedWinner: significantWinners.length > 0 ? significantWinners[0].variant.id : null,
    };
  }

  // ══════════════════════════════════════════════
  //  FUNNEL
  // ══════════════════════════════════════════════

  /** Build conversion funnel for a landing page */
  buildFunnel(landingPageId: string): ConversionFunnel {
    const dataPoints = conversionMetricsCollector.getByLandingPage(landingPageId);

    const stepOrder: Array<{ name: string; type: string }> = [
      { name: 'Page View', type: 'page_view' },
      { name: 'Scroll Depth', type: 'scroll_depth' },
      { name: 'CTA Click', type: 'cta_click' },
      { name: 'Signup Started', type: 'signup_started' },
      { name: 'Signup Completed', type: 'signup_completed' },
      { name: 'Plan Selected', type: 'plan_selected' },
      { name: 'Revenue Generated', type: 'revenue_generated' },
    ];

    const counts = new Map<string, number>();
    for (const dp of dataPoints) {
      counts.set(dp.metricType, (counts.get(dp.metricType) || 0) + 1);
    }

    const steps: FunnelStep[] = [];
    let prevCount = 0;
    for (const s of stepOrder) {
      const count = counts.get(s.type) || 0;
      if (count === 0 && steps.length === 0) continue;
      const rate = prevCount > 0 ? Math.round((count / prevCount) * 10000) / 100 : 100;
      steps.push({ name: s.name, metricType: s.type as any, count, rate });
      prevCount = count || prevCount;
    }

    const dropOffPoints = steps.slice(1).map((s) => ({
      step: s.name,
      dropRate: Math.round((1 - s.rate / 100) * 10000) / 100,
    })).filter(d => d.dropRate > 20);

    return {
      landingPageId,
      steps,
      overallRate: steps.length >= 2
        ? Math.round((steps[steps.length - 1].count / steps[0].count) * 10000) / 100
        : 0,
      dropOffPoints,
    };
  }

  // ══════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════

  private computeKPIs(points: ConversionDataPoint[]): ConversionKPIs {
    const pageViews = points.filter(p => p.metricType === 'page_view').length;
    const uniqueVisitors = new Set(points.map(p => p.visitorId)).size;
    const ctaClicks = points.filter(p => p.metricType === 'cta_click').length;
    const signupsStarted = points.filter(p => p.metricType === 'signup_started').length;
    const signupsCompleted = points.filter(p => p.metricType === 'signup_completed').length;
    const totalRevenue = points
      .filter(p => p.metricType === 'revenue_generated')
      .reduce((sum, p) => sum + p.value, 0);

    return {
      conversionRate: this.calcConversionRate(points),
      revenuePerVisitor: this.calcRevenuePerVisitor(points),
      ctr: this.calcCTR(points),
      fabEngagementScore: this.calcFABEngagementScore(points),
      pageViews,
      uniqueVisitors,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      ctaClicks,
      signupsStarted,
      signupsCompleted,
    };
  }

  /** Approximate two-tailed p-value from z-score */
  private zToPValue(z: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    const erf = sign * y;
    return 1 - (0.5 * (1 + erf));
  }
}

export const conversionAnalyzer = new ConversionAnalyzer();
export { ConversionAnalyzer };
