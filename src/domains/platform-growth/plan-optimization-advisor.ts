/**
 * PlanOptimizationAdvisor — Suggests plan changes to maximize revenue per tenant.
 *
 * Integrates with:
 *  - RevenueIntelligence (metrics by plan, upgrade candidates)
 *  - LandingPageBuilder (conversion data per LP)
 *  - ConversionTrackingService (funnel events)
 */
import type { PlanOptimizationSuggestion } from './types';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { RevenueMetrics, UpgradeCandidate } from '@/domains/revenue-intelligence';
import { landingPageBuilder } from './landing-page-builder';
import { conversionTrackingService } from './conversion-tracking-service';
import type { LandingPage } from './types';

// ── Helpers ────────────────────────────────────────────────────

function buildUpgradeSuggestions(candidates: UpgradeCandidate[]): PlanOptimizationSuggestion[] {
  return candidates.map((c, i) => ({
    id: `po-upgrade-${i}`,
    currentPlan: c.current_plan,
    suggestedPlan: c.recommended_plan,
    reason: `Tenant usa ${c.usage_pct}% do plano "${c.current_plan}". Sinais: ${c.signals.join(', ')}.`,
    expectedRevenueImpact: c.potential_uplift_brl,
    tenantId: c.tenant_id,
    tenantName: c.tenant_name,
    confidence: c.usage_pct >= 80 ? 92 : c.usage_pct >= 60 ? 78 : 60,
  }));
}

function buildPlanConversionSuggestions(
  metrics: RevenueMetrics,
  pages: LandingPage[],
): PlanOptimizationSuggestion[] {
  const plans = metrics.revenue_by_plan ?? [];
  if (plans.length < 2) return [];

  // Rank plans by ARPA (MRR / tenants)
  const ranked = [...plans]
    .map(p => ({ ...p, arpa: p.mrr / Math.max(p.tenants, 1) }))
    .sort((a, b) => b.arpa - a.arpa);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  // Find best-performing LP
  const sortedPages = [...pages].sort(
    (a, b) => b.analytics.conversionRate - a.analytics.conversionRate,
  );
  const bestLP = sortedPages[0];

  const suggestions: PlanOptimizationSuggestion[] = [];

  // Suggestion: Promote best-ARPA plan via best LP
  if (bestLP) {
    suggestions.push({
      id: `po-lp-conv-${Date.now()}`,
      currentPlan: worst.plan_name,
      suggestedPlan: best.plan_name,
      reason: `Plano "${best.plan_name}" está convertendo mais via landing page "${bestLP.name}" (${bestLP.analytics.conversionRate}% conv. rate, ${bestLP.analytics.conversions} conversões). ARPA de R$ ${Math.round(best.arpa)}/tenant vs R$ ${Math.round(worst.arpa)} no "${worst.plan_name}".`,
      expectedRevenueImpact: Math.round((best.arpa - worst.arpa) * worst.tenants * 0.15),
      tenantId: '*',
      tenantName: `${worst.tenants} tenants em "${worst.plan_name}"`,
      confidence: bestLP.analytics.conversionRate > 5 ? 90 : 72,
    });
  }

  // Suggestion: LP source-based insight
  if (bestLP && bestLP.analytics.topSources.length > 0) {
    const topSource = bestLP.analytics.topSources[0];
    const events = conversionTrackingService.getByPage(bestLP.id);
    const purchases = events.filter(e => e.type === 'purchase');
    const revenue = purchases.reduce((s, e) => s + (e.revenue ?? 0), 0);

    suggestions.push({
      id: `po-source-${Date.now()}`,
      currentPlan: worst.plan_name,
      suggestedPlan: best.plan_name,
      reason: `Canal "${topSource.source}" trouxe ${topSource.visits} visitas para LP "${bestLP.name}" com ${purchases.length} compras (R$ ${revenue.toLocaleString()}). Direcionar tráfego deste canal para upgrade do "${worst.plan_name}" → "${best.plan_name}".`,
      expectedRevenueImpact: Math.round(revenue * 0.3),
      tenantId: '*',
      tenantName: `Tenants via ${topSource.source}`,
      confidence: 75,
    });
  }

  return suggestions;
}

// ── Public API ─────────────────────────────────────────────────

export class PlanOptimizationAdvisor {
  /**
   * Generate suggestions from real Revenue Intelligence + LP data.
   */
  async getSuggestions(): Promise<PlanOptimizationSuggestion[]> {
    try {
      const engine = getRevenueIntelligenceEngine();

      const [metrics, candidates] = await Promise.all([
        engine.analyzer.getMetrics(),
        engine.upgrade.getCandidates(),
      ]);

      const pages = await landingPageBuilder.getAll();

      const suggestions: PlanOptimizationSuggestion[] = [
        ...buildPlanConversionSuggestions(metrics, pages),
        ...buildUpgradeSuggestions(candidates),
      ];

      // Sort by confidence desc, then revenue impact desc
      suggestions.sort((a, b) => {
        const confDiff = b.confidence - a.confidence;
        return confDiff !== 0 ? confDiff : b.expectedRevenueImpact - a.expectedRevenueImpact;
      });

      return suggestions;
    } catch (err) {
      console.error('[PlanOptimizationAdvisor] Error:', err);
      return [];
    }
  }
}

export const planOptimizationAdvisor = new PlanOptimizationAdvisor();
