/**
 * GrowthInsightEngine — AI-powered growth strategy suggestions.
 *
 * Consumes real data from:
 *  - RevenueIntelligence (analyzer, churn, upgrade)
 *  - ReferralEngine (programs, links, tracking)
 *  - BillingCore (revenue metrics, usage)
 *  - Landing page analytics (ConversionTrackingService)
 *
 * Produces actionable insights for acquisition, retention, expansion, and reactivation.
 */
import type { GrowthInsight, LandingPage } from './types';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { RevenueMetrics, ChurnRiskTenant, UpgradeCandidate, ReferralProgram, ReferralTracking } from '@/domains/revenue-intelligence';

// ── Helper: build insight from data ────────────────────────────

function buildPlanConversionInsights(metrics: RevenueMetrics): GrowthInsight[] {
  const plans = [...(metrics.revenue_by_plan ?? [])].sort((a, b) => {
    // best conversion = highest ARPA * tenant count
    const scoreA = a.mrr / Math.max(a.tenants, 1);
    const scoreB = b.mrr / Math.max(b.tenants, 1);
    return scoreB - scoreA;
  });

  if (plans.length === 0) return [];

  const best = plans[0];
  const worst = plans[plans.length - 1];

  return [{
    id: `gi-plan-conv-${Date.now()}`,
    type: 'expansion',
    title: `Plano "${best.plan_name}" tem melhor ARPA`,
    description: `Com ARPA de R$ ${(best.mrr / Math.max(best.tenants, 1)).toFixed(0)}/tenant, "${best.plan_name}" gera ${((best.mrr / Math.max(metrics.mrr, 1)) * 100).toFixed(0)}% do MRR total. Priorize upsell de tenants em "${worst.plan_name}" para este plano.`,
    impact: best.mrr > metrics.mrr * 0.5 ? 'critical' : 'high',
    confidence: 85,
    suggestedActions: [
      `Criar LP comparativa "${worst.plan_name}" vs "${best.plan_name}"`,
      'Oferecer trial de 14 dias no plano superior',
      'Configurar GTM event para tracking de cliques no upgrade',
    ],
    metrics: {
      best_plan_arpa: Math.round(best.mrr / Math.max(best.tenants, 1)),
      best_plan_tenants: best.tenants,
      worst_plan_arpa: Math.round(worst.mrr / Math.max(worst.tenants, 1)),
      total_mrr: metrics.mrr,
    },
    createdAt: new Date().toISOString(),
  }];
}

function buildModuleInsights(metrics: RevenueMetrics): GrowthInsight[] {
  const modules = [...(metrics.revenue_by_module ?? [])].sort((a, b) => b.total_brl - a.total_brl);
  if (modules.length < 2) return [];

  const top = modules[0];
  const bottom = modules[modules.length - 1];

  return [{
    id: `gi-mod-${Date.now()}`,
    type: 'acquisition',
    title: `Módulo "${top.module_id}" é o mais vendido`,
    description: `Gera R$ ${top.total_brl.toLocaleString()} em receita com ${top.records} registros. Use como destaque principal nas landing pages. Módulo "${bottom.module_id}" pode ser bundled como add-on.`,
    impact: 'high',
    confidence: 90,
    suggestedActions: [
      `Destacar "${top.module_id}" como hero feature na LP principal`,
      `Criar bundle "${top.module_id}" + "${bottom.module_id}" com desconto`,
      'Adicionar depoimentos de clientes que usam este módulo',
    ],
    metrics: {
      top_module_revenue: top.total_brl,
      top_module_records: top.records,
      bottom_module_revenue: bottom.total_brl,
      module_count: modules.length,
    },
    createdAt: new Date().toISOString(),
  }];
}

function buildChurnInsights(atRisk: ChurnRiskTenant[]): GrowthInsight[] {
  if (atRisk.length === 0) return [];

  const totalMrrAtRisk = atRisk.reduce((s, t) => s + t.mrr_at_risk, 0);
  const highRisk = atRisk.filter(t => t.risk_score >= 70);

  return [{
    id: `gi-churn-${Date.now()}`,
    type: 'retention',
    title: `${atRisk.length} tenants em risco de churn`,
    description: `R$ ${totalMrrAtRisk.toLocaleString()}/mês em risco. ${highRisk.length} com score ≥70. Uma LP de reativação com oferta exclusiva pode recuperar até 30% dos inativos.`,
    impact: totalMrrAtRisk > 5000 ? 'critical' : 'high',
    confidence: 88,
    suggestedActions: [
      'Criar LP de retenção com desconto exclusivo de 30 dias',
      'Integrar com BillingCore para gerar cupom automático',
      'Configurar email drip campaign via ConversionTrackingService',
      `Top risco: ${highRisk[0]?.tenant_name ?? 'N/A'} (score ${highRisk[0]?.risk_score ?? 0})`,
    ],
    metrics: {
      tenants_at_risk: atRisk.length,
      high_risk_count: highRisk.length,
      mrr_at_risk: totalMrrAtRisk,
      avg_risk_score: Math.round(atRisk.reduce((s, t) => s + t.risk_score, 0) / atRisk.length),
    },
    createdAt: new Date().toISOString(),
  }];
}

function buildUpgradeInsights(candidates: UpgradeCandidate[]): GrowthInsight[] {
  if (candidates.length === 0) return [];

  const totalUplift = candidates.reduce((s, c) => s + c.potential_uplift_brl, 0);

  return [{
    id: `gi-upgrade-${Date.now()}`,
    type: 'expansion',
    title: `${candidates.length} tenants prontos para upgrade`,
    description: `Potencial de +R$ ${totalUplift.toLocaleString()}/mês com upgrades. ${candidates[0].tenant_name} usa ${candidates[0].usage_pct}% do plano "${candidates[0].current_plan}".`,
    impact: totalUplift > 3000 ? 'critical' : 'high',
    confidence: candidates[0].usage_pct >= 80 ? 92 : 75,
    suggestedActions: [
      'Criar LP de comparação de planos focada nos limites atingidos',
      `Highlight: ${candidates[0].signals.join(', ')}`,
      'Integrar ConversionTracking para rastrear cliques do upgrade CTA',
      'Conectar com PlanOptimizationAdvisor para sugestão personalizada',
    ],
    metrics: {
      upgrade_candidates: candidates.length,
      potential_uplift_brl: totalUplift,
      top_usage_pct: candidates[0].usage_pct,
    },
    createdAt: new Date().toISOString(),
  }];
}

function buildReferralInsights(programs: ReferralProgram[], tracking: ReferralTracking[]): GrowthInsight[] {
  const activePrograms = programs.filter(p => p.is_active);
  const conversions = tracking.filter(t => t.converted_at);

  const conversionRate = tracking.length > 0
    ? (conversions.length / tracking.length) * 100
    : 0;

  return [{
    id: `gi-referral-${Date.now()}`,
    type: 'acquisition',
    title: `Referral: ${conversionRate.toFixed(1)}% de conversão`,
    description: `${activePrograms.length} programa(s) ativo(s), ${tracking.length} indicação(ões) rastreadas, ${conversions.length} conversão(ões). ${conversionRate > 20 ? 'Performance acima da média — escalar campanha.' : 'Oportunidade de otimizar incentivos.'}`,
    impact: conversionRate > 20 ? 'high' : 'medium',
    confidence: 82,
    suggestedActions: [
      conversionRate > 20
        ? 'Escalar: criar LP dedicada ao programa de referral'
        : 'Aumentar incentivo: testar reward de R$ 50 vs R$ 100',
      'Integrar link de referral nas landing pages existentes',
      'Adicionar GTM event para tracking de share e click',
    ],
    metrics: {
      active_programs: activePrograms.length,
      total_referrals: tracking.length,
      total_conversions: conversions.length,
      conversion_rate: Number(conversionRate.toFixed(1)),
    },
    createdAt: new Date().toISOString(),
  }];
}

function buildLandingPageInsights(pages: LandingPage[]): GrowthInsight[] {
  if (pages.length === 0) return [];

  const sorted = [...pages].sort((a, b) => b.analytics.conversionRate - a.analytics.conversionRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const insights: GrowthInsight[] = [{
    id: `gi-lp-${Date.now()}`,
    type: 'acquisition',
    title: `LP "${best.name}" tem ${best.analytics.conversionRate}% de conversão`,
    description: `${best.analytics.views.toLocaleString()} views, ${best.analytics.conversions} conversões. ${best.analytics.topSources[0]?.source ?? 'Orgânico'} é a principal fonte. ${pages.length > 1 ? `"${worst.name}" tem apenas ${worst.analytics.conversionRate}% — replicar estrutura da melhor LP.` : ''}`,
    impact: best.analytics.conversionRate > 5 ? 'high' : 'medium',
    confidence: 88,
    suggestedActions: [
      `Replicar estrutura de blocos da LP "${best.slug}" para novas páginas`,
      'A/B test: testar headline alternativa no hero block',
      `Investir em ${best.analytics.topSources[0]?.source ?? 'orgânico'} como canal principal`,
    ],
    metrics: {
      best_lp_views: best.analytics.views,
      best_lp_rate: best.analytics.conversionRate,
      best_lp_bounce: best.analytics.bounceRate,
      total_pages: pages.length,
    },
    createdAt: new Date().toISOString(),
  }];

  return insights;
}

// ── Public API ─────────────────────────────────────────────────

export interface GrowthInsightResult {
  insights: GrowthInsight[];
  metrics: {
    totalMRR: number;
    payingTenants: number;
    churnRate: number;
    upgradeCandidates: number;
    mrrAtRisk: number;
    referralConversionRate: number;
    bestPlan: string;
    bestModule: string;
  };
  loading: boolean;
  error: string | null;
}

export class GrowthInsightEngine {
  /**
   * Fetch real data from all engines and produce combined insights.
   */
  async generateInsights(landingPages: LandingPage[] = []): Promise<GrowthInsightResult> {
    try {
      const engine = getRevenueIntelligenceEngine();

      // Parallel fetch from all sources
      const [metrics, atRisk, candidates, programs, tracking] = await Promise.all([
        engine.analyzer.getMetrics(),
        engine.churn.getAtRiskTenants(),
        engine.upgrade.getCandidates(),
        engine.referral.getPrograms(true),
        engine.referral.getTracking(),
      ]);

      // Build insights from each data source
      const allInsights: GrowthInsight[] = [
        ...buildPlanConversionInsights(metrics),
        ...buildModuleInsights(metrics),
        ...buildChurnInsights(atRisk),
        ...buildUpgradeInsights(candidates),
        ...buildReferralInsights(programs, tracking),
        ...buildLandingPageInsights(landingPages),
      ];

      // Sort by impact severity + confidence
      const impactOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      allInsights.sort((a, b) => {
        const impactDiff = (impactOrder[b.impact] ?? 0) - (impactOrder[a.impact] ?? 0);
        return impactDiff !== 0 ? impactDiff : b.confidence - a.confidence;
      });

      // Compute referral conversion rate
      const conversions = tracking.filter(t => t.converted_at);
      const referralConversionRate = tracking.length > 0
        ? (conversions.length / tracking.length) * 100
        : 0;

      // Best plan + module
      const bestPlan = [...(metrics.revenue_by_plan ?? [])].sort((a, b) => b.mrr - a.mrr)[0];
      const bestModule = [...(metrics.revenue_by_module ?? [])].sort((a, b) => b.total_brl - a.total_brl)[0];

      return {
        insights: allInsights,
        metrics: {
          totalMRR: metrics.mrr,
          payingTenants: metrics.paying_tenants,
          churnRate: metrics.churn_rate_pct,
          upgradeCandidates: candidates.length,
          mrrAtRisk: atRisk.reduce((s, t) => s + t.mrr_at_risk, 0),
          referralConversionRate: Number(referralConversionRate.toFixed(1)),
          bestPlan: bestPlan?.plan_name ?? '—',
          bestModule: bestModule?.module_id ?? '—',
        },
        loading: false,
        error: null,
      };
    } catch (err) {
      console.error('[GrowthInsightEngine] Error generating insights:', err);
      return {
        insights: [],
        metrics: {
          totalMRR: 0, payingTenants: 0, churnRate: 0, upgradeCandidates: 0,
          mrrAtRisk: 0, referralConversionRate: 0, bestPlan: '—', bestModule: '—',
        },
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

export const growthInsightEngine = new GrowthInsightEngine();
