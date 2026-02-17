/**
 * ConversionAnalyzer — Statistical analysis of experiment results.
 * Calculates significance, lift, and funnels.
 */
import type { ABExperiment, ABVariant, ConversionFunnel, FunnelStep, ExperimentId } from './types';
import { abTestingManager } from './ab-testing-manager';
import { conversionMetricsCollector } from './conversion-metrics-collector';

class ConversionAnalyzer {
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

    // Update variant confidence
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
      results,
      suggestedWinner: significantWinners.length > 0 ? significantWinners[0].variant.id : null,
    };
  }

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
      const key = dp.metadata?.type === 'impression' ? 'impression' : dp.metricType;
      counts.set(key, (counts.get(key) || 0) + 1);
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

    const dropOffPoints = steps.slice(1).map((s, i) => ({
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

  // ── Private ──

  /** Approximate two-tailed p-value from z-score */
  private zToPValue(z: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    const erf = sign * y;
    return 1 - (0.5 * (1 + erf)); // two-tailed
  }
}

export const conversionAnalyzer = new ConversionAnalyzer();
export { ConversionAnalyzer };
