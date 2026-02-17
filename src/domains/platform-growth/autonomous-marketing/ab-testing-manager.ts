/**
 * ABTestingManager — Manages the lifecycle of A/B experiments.
 * Create, start, pause, stop, and declare winners for landing page experiments.
 * Integrates with GTM to push ab_variant_assigned, ab_conversion, ab_winner_selected.
 */
import type {
  ABExperiment, ABVariant, ExperimentId, ExperimentStatus,
  VariantAllocationStrategy, ConversionMetricType,
} from './types';
import { tagManagerIntegration } from '../tag-manager-integration';

class ABTestingManager {
  private experiments: Map<ExperimentId, ABExperiment> = new Map();

  /** Create a new A/B experiment */
  createExperiment(input: {
    name: string;
    description: string;
    landingPageId: string;
    strategy?: VariantAllocationStrategy;
    primaryMetric?: ConversionMetricType;
    trafficPercentage?: number;
    confidenceLevel?: number;
    minSampleSize?: number;
    createdBy: string;
  }): ABExperiment {
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const experiment: ABExperiment = {
      id,
      name: input.name,
      description: input.description,
      landingPageId: input.landingPageId,
      status: 'draft',
      strategy: input.strategy || 'equal',
      variants: [],
      primaryMetric: input.primaryMetric || 'signup_completed',
      secondaryMetrics: ['cta_click', 'scroll_depth', 'page_view'],
      trafficPercentage: input.trafficPercentage || 100,
      startedAt: null,
      endedAt: null,
      winnerVariantId: null,
      confidenceLevel: input.confidenceLevel || 95,
      minSampleSize: input.minSampleSize || 100,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-create control variant
    experiment.variants.push(this.createVariant(id, 'Control', true, 50));
    this.experiments.set(id, experiment);
    return experiment;
  }

  /** Add a variant to an experiment */
  addVariant(experimentId: ExperimentId, name: string, blockOverrides: Record<string, unknown> = {}): ABVariant {
    const exp = this.getExperiment(experimentId);
    if (exp.status !== 'draft') throw new Error('Cannot add variants to a running experiment');
    if (exp.variants.length >= 4) throw new Error('Maximum 4 variants per experiment');

    const variant = this.createVariant(experimentId, name, false, 0, blockOverrides);
    exp.variants.push(variant);
    this.rebalanceWeights(exp);
    exp.updatedAt = new Date().toISOString();
    return variant;
  }

  /** Start running an experiment */
  startExperiment(experimentId: ExperimentId): ABExperiment {
    const exp = this.getExperiment(experimentId);
    if (exp.variants.length < 2) throw new Error('Need at least 2 variants to start');
    if (exp.status !== 'draft' && exp.status !== 'paused') throw new Error(`Cannot start experiment in ${exp.status} status`);

    exp.status = 'running';
    exp.startedAt = exp.startedAt || new Date().toISOString();
    exp.updatedAt = new Date().toISOString();
    return exp;
  }

  /** Assign a visitor to a variant and push GTM event */
  assignVariant(experimentId: ExperimentId, variantId: string): ABVariant {
    const exp = this.getExperiment(experimentId);
    if (exp.status !== 'running') throw new Error('Experiment is not running');
    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) throw new Error('Variant not found');

    variant.metrics.impressions++;
    tagManagerIntegration.trackVariantAssigned({
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant_id: variant.id,
      variant_name: variant.name,
      is_control: variant.isControl,
      page_id: exp.landingPageId,
    });
    return variant;
  }

  /** Record a conversion for a variant and push GTM event */
  recordConversion(experimentId: ExperimentId, variantId: string, metric: ConversionMetricType, value?: number): void {
    const exp = this.getExperiment(experimentId);
    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) throw new Error('Variant not found');

    variant.metrics.conversions++;
    variant.metrics.conversionRate = variant.metrics.impressions > 0
      ? Math.round((variant.metrics.conversions / variant.metrics.impressions) * 10000) / 100
      : 0;
    if (value) variant.metrics.revenue += value;

    tagManagerIntegration.trackABConversion({
      experiment_id: exp.id,
      experiment_name: exp.name,
      variant_id: variant.id,
      variant_name: variant.name,
      conversion_metric: metric,
      conversion_value: value,
      page_id: exp.landingPageId,
    });
  }

  /** Pause a running experiment */
  pauseExperiment(experimentId: ExperimentId): ABExperiment {
    const exp = this.getExperiment(experimentId);
    if (exp.status !== 'running') throw new Error('Can only pause running experiments');
    exp.status = 'paused';
    exp.updatedAt = new Date().toISOString();
    return exp;
  }

  /** Complete an experiment, declare winner, and push GTM event */
  completeExperiment(experimentId: ExperimentId, winnerVariantId: string): ABExperiment {
    const exp = this.getExperiment(experimentId);
    const winner = exp.variants.find(v => v.id === winnerVariantId);
    if (!winner) throw new Error('Winner variant not found');

    exp.status = 'completed';
    exp.winnerVariantId = winnerVariantId;
    exp.endedAt = new Date().toISOString();
    exp.updatedAt = new Date().toISOString();

    const totalImpressions = exp.variants.reduce((s, v) => s + v.metrics.impressions, 0);
    tagManagerIntegration.trackWinnerSelected({
      experiment_id: exp.id,
      experiment_name: exp.name,
      winner_variant_id: winner.id,
      winner_variant_name: winner.name,
      confidence_level: exp.confidenceLevel,
      total_impressions: totalImpressions,
      winning_conversion_rate: winner.metrics.conversionRate,
      page_id: exp.landingPageId,
    });

    return exp;
  }

  /** Cancel an experiment */
  cancelExperiment(experimentId: ExperimentId): ABExperiment {
    const exp = this.getExperiment(experimentId);
    exp.status = 'cancelled';
    exp.endedAt = new Date().toISOString();
    exp.updatedAt = new Date().toISOString();
    return exp;
  }

  /** Get experiment by ID */
  getExperiment(id: ExperimentId): ABExperiment {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error(`Experiment ${id} not found`);
    return exp;
  }

  /** List experiments for a landing page */
  listByLandingPage(landingPageId: string): ABExperiment[] {
    return Array.from(this.experiments.values())
      .filter(e => e.landingPageId === landingPageId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** List experiments by status */
  listByStatus(status: ExperimentStatus): ABExperiment[] {
    return Array.from(this.experiments.values())
      .filter(e => e.status === status);
  }

  /** Check if experiment has reached statistical significance */
  hasReachedSignificance(experimentId: ExperimentId): boolean {
    const exp = this.getExperiment(experimentId);
    const control = exp.variants.find(v => v.isControl);
    if (!control) return false;

    return exp.variants.some(v =>
      !v.isControl &&
      v.metrics.impressions >= exp.minSampleSize &&
      (v.metrics.confidenceVsControl || 0) >= exp.confidenceLevel
    );
  }

  // ── Private ──

  private createVariant(
    experimentId: ExperimentId,
    name: string,
    isControl: boolean,
    weight: number,
    blockOverrides: Record<string, unknown> = {},
  ): ABVariant {
    return {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      experimentId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      weight,
      isControl,
      blockOverrides,
      metrics: { impressions: 0, conversions: 0, conversionRate: 0, avgTimeOnPage: 0, bounceRate: 0, revenue: 0, confidenceVsControl: null },
    };
  }

  private rebalanceWeights(exp: ABExperiment) {
    if (exp.strategy === 'equal') {
      const w = Math.floor(100 / exp.variants.length);
      exp.variants.forEach((v, i) => {
        v.weight = i === 0 ? 100 - w * (exp.variants.length - 1) : w;
      });
    }
  }
}

export const abTestingManager = new ABTestingManager();
export { ABTestingManager };
