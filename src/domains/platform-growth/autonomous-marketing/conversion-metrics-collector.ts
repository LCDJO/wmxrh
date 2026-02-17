/**
 * ConversionMetricsCollector — Ingests raw conversion events and updates variant metrics.
 */
import type { ConversionDataPoint, ConversionMetricType, ExperimentId, VariantId } from './types';
import { abTestingManager } from './ab-testing-manager';

class ConversionMetricsCollector {
  private dataPoints: ConversionDataPoint[] = [];

  /** Record a conversion event */
  track(input: {
    landingPageId: string;
    metricType: ConversionMetricType;
    value?: number;
    sessionId: string;
    visitorId: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referralCode?: string;
    experimentId?: ExperimentId;
    variantId?: VariantId;
    metadata?: Record<string, unknown>;
  }): ConversionDataPoint {
    const point: ConversionDataPoint = {
      id: `cdp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      experimentId: input.experimentId || null,
      variantId: input.variantId || null,
      landingPageId: input.landingPageId,
      metricType: input.metricType,
      value: input.value ?? 1,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      source: input.source || 'direct',
      medium: input.medium || 'none',
      campaign: input.campaign || null,
      referralCode: input.referralCode || null,
      metadata: input.metadata || {},
      trackedAt: new Date().toISOString(),
    };

    this.dataPoints.push(point);

    // Update variant metrics if part of an experiment
    if (point.experimentId && point.variantId) {
      this.updateVariantMetrics(point);
    }

    return point;
  }

  /** Record an impression (page view) */
  trackImpression(input: {
    landingPageId: string;
    sessionId: string;
    visitorId: string;
    experimentId?: ExperimentId;
    variantId?: VariantId;
    source?: string;
  }): void {
    if (input.experimentId && input.variantId) {
      try {
        const exp = abTestingManager.getExperiment(input.experimentId);
        const variant = exp.variants.find(v => v.id === input.variantId);
        if (variant) {
          variant.metrics.impressions++;
          this.recalcConversionRate(variant);
        }
      } catch { /* experiment not found, skip */ }
    }

    this.track({
      ...input,
      metricType: 'cta_click', // impressions tracked as special event
      value: 0,
      metadata: { type: 'impression' },
    });
  }

  /** Get all data points for a landing page */
  getByLandingPage(landingPageId: string, since?: string): ConversionDataPoint[] {
    return this.dataPoints.filter(dp =>
      dp.landingPageId === landingPageId &&
      (!since || dp.trackedAt >= since)
    );
  }

  /** Get data points for an experiment */
  getByExperiment(experimentId: ExperimentId): ConversionDataPoint[] {
    return this.dataPoints.filter(dp => dp.experimentId === experimentId);
  }

  /** Aggregate metrics by source */
  aggregateBySource(landingPageId: string): Array<{ source: string; count: number; conversions: number; rate: number }> {
    const points = this.getByLandingPage(landingPageId);
    const sourceMap = new Map<string, { count: number; conversions: number }>();

    for (const p of points) {
      const entry = sourceMap.get(p.source) || { count: 0, conversions: 0 };
      entry.count++;
      if (['signup_completed', 'plan_selected', 'revenue_generated'].includes(p.metricType)) {
        entry.conversions++;
      }
      sourceMap.set(p.source, entry);
    }

    return Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      count: data.count,
      conversions: data.conversions,
      rate: data.count > 0 ? Math.round((data.conversions / data.count) * 10000) / 100 : 0,
    }));
  }

  // ── Private ──

  private updateVariantMetrics(point: ConversionDataPoint) {
    try {
      const exp = abTestingManager.getExperiment(point.experimentId!);
      const variant = exp.variants.find(v => v.id === point.variantId);
      if (!variant) return;

      if (['signup_completed', 'plan_selected', 'revenue_generated'].includes(point.metricType)) {
        variant.metrics.conversions++;
      }
      if (point.metricType === 'revenue_generated') {
        variant.metrics.revenue += point.value;
      }
      this.recalcConversionRate(variant);
    } catch { /* skip */ }
  }

  private recalcConversionRate(variant: { metrics: { impressions: number; conversions: number; conversionRate: number } }) {
    variant.metrics.conversionRate = variant.metrics.impressions > 0
      ? Math.round((variant.metrics.conversions / variant.metrics.impressions) * 10000) / 100
      : 0;
  }
}

export const conversionMetricsCollector = new ConversionMetricsCollector();
export { ConversionMetricsCollector };
