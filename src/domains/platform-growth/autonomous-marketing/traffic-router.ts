/**
 * TrafficRouter — Routes incoming visitors to the correct variant
 * based on experiment rules, conditions, and allocation strategy.
 */
import type { TrafficRule, TrafficCondition, ExperimentId, VariantId } from './types';
import { abTestingManager } from './ab-testing-manager';
import { variantAllocator } from './variant-allocator';

interface RouteResult {
  experimentId: ExperimentId;
  variantId: VariantId;
  variantSlug: string;
  isControl: boolean;
  matchedRule: string | null;
}

class TrafficRouter {
  private rules: Map<ExperimentId, TrafficRule[]> = new Map();

  /** Add a targeting rule to an experiment */
  addRule(rule: Omit<TrafficRule, 'id'>): TrafficRule {
    const fullRule: TrafficRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const existing = this.rules.get(rule.experimentId) || [];
    existing.push(fullRule);
    existing.sort((a, b) => b.priority - a.priority);
    this.rules.set(rule.experimentId, existing);
    return fullRule;
  }

  /** Route a visitor — checks rules first, falls back to allocation */
  route(input: {
    visitorId: string;
    landingPageId: string;
    source?: string;
    medium?: string;
    campaign?: string;
    device?: string;
    geo?: string;
    referral?: string;
  }): RouteResult | null {
    // Find running experiments for this landing page
    const experiments = abTestingManager.listByLandingPage(input.landingPageId)
      .filter(e => e.status === 'running');

    if (experiments.length === 0) return null;

    // Use first active experiment (priority-based in production)
    const experiment = experiments[0];

    // Check targeting rules first
    const rules = this.rules.get(experiment.id) || [];
    for (const rule of rules) {
      if (this.evaluateConditions(rule.conditions, input)) {
        const variant = experiment.variants.find(v => v.id === rule.variantId);
        if (variant) {
          return {
            experimentId: experiment.id,
            variantId: variant.id,
            variantSlug: variant.slug,
            isControl: variant.isControl,
            matchedRule: rule.id,
          };
        }
      }
    }

    // Fall back to standard allocation
    const allocation = variantAllocator.allocate(input.visitorId, experiment.id);
    const variant = experiment.variants.find(v => v.id === allocation.variantId);

    return {
      experimentId: experiment.id,
      variantId: allocation.variantId,
      variantSlug: variant?.slug || 'control',
      isControl: variant?.isControl || false,
      matchedRule: null,
    };
  }

  /** Remove all rules for an experiment */
  clearRules(experimentId: ExperimentId): void {
    this.rules.delete(experimentId);
  }

  /** Get rules for an experiment */
  getRules(experimentId: ExperimentId): TrafficRule[] {
    return this.rules.get(experimentId) || [];
  }

  // ── Private ──

  private evaluateConditions(
    conditions: TrafficCondition[],
    context: Record<string, string | undefined>,
  ): boolean {
    return conditions.every(cond => {
      const actual = context[cond.field] || '';
      switch (cond.operator) {
        case 'equals': return actual === cond.value;
        case 'not_equals': return actual !== cond.value;
        case 'contains': return actual.includes(cond.value);
        case 'matches': return new RegExp(cond.value, 'i').test(actual);
        default: return false;
      }
    });
  }
}

export const trafficRouter = new TrafficRouter();
export { TrafficRouter };
