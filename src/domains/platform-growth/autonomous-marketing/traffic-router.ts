/**
 * TrafficRouter — Routes visitors to variants using DB-backed sticky allocations.
 * Uses visitor_id (cookie/session) to guarantee consistency.
 */
import { supabase } from '@/integrations/supabase/client';
import type { TrafficRule, TrafficCondition, ExperimentId, VariantId } from './types';

interface RouteResult {
  experimentId: ExperimentId;
  variantId: VariantId;
  variantSlug: string;
  isNew: boolean; // true if freshly allocated
}

interface DBVariant {
  id: string;
  weight_percentage: number;
  headline_variant: string | null;
  cta_variant: string | null;
}

class TrafficRouter {
  private rules: Map<ExperimentId, TrafficRule[]> = new Map();

  /** Route a visitor — checks existing allocation first, then assigns deterministically */
  async route(input: {
    visitorId: string;
    experimentId: string;
  }): Promise<RouteResult | null> {
    const { visitorId, experimentId } = input;

    // 1. Check for existing sticky allocation
    const { data: existing } = await supabase
      .from('landing_traffic_allocations')
      .select('variant_id')
      .eq('experiment_id', experimentId)
      .eq('visitor_id', visitorId)
      .maybeSingle();

    if (existing?.variant_id) {
      return {
        experimentId,
        variantId: existing.variant_id,
        variantSlug: existing.variant_id,
        isNew: false,
      };
    }

    // 2. Fetch variants for experiment
    const { data: variants } = await supabase
      .from('landing_variants')
      .select('id, weight_percentage, headline_variant, cta_variant')
      .eq('experiment_id', experimentId);

    if (!variants || variants.length === 0) return null;

    // 3. Allocate based on weight
    const selectedVariant = this.selectByWeight(visitorId, experimentId, variants as DBVariant[]);

    // 4. Persist sticky allocation
    await supabase.from('landing_traffic_allocations').insert({
      experiment_id: experimentId,
      visitor_id: visitorId,
      variant_id: selectedVariant.id,
    });

    return {
      experimentId,
      variantId: selectedVariant.id,
      variantSlug: selectedVariant.id,
      isNew: true,
    };
  }

  /** Add a targeting rule */
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

  getRules(experimentId: ExperimentId): TrafficRule[] {
    return this.rules.get(experimentId) || [];
  }

  clearRules(experimentId: ExperimentId): void {
    this.rules.delete(experimentId);
  }

  // ── Private ──

  /** Deterministic hash-based weighted selection */
  private selectByWeight(visitorId: string, experimentId: string, variants: DBVariant[]): DBVariant {
    const hash = this.simpleHash(`${visitorId}:${experimentId}`);
    const bucket = hash % 100;

    let cumulative = 0;
    for (const v of variants) {
      cumulative += v.weight_percentage;
      if (bucket < cumulative) return v;
    }
    return variants[0]; // fallback
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const trafficRouter = new TrafficRouter();
export { TrafficRouter };
