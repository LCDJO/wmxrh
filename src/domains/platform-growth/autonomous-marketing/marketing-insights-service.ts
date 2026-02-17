/**
 * MarketingInsightsService — Generates high-level marketing intelligence
 * by aggregating signals from experiments, conversions, and performance rankings.
 */
import type { MarketingInsight, LandingPerformanceScore, ExperimentSuggestion } from './types';
import { abTestingManager } from './ab-testing-manager';
import { conversionMetricsCollector } from './conversion-metrics-collector';
import { landingPerformanceRanker } from './landing-performance-ranker';
import { aiExperimentAdvisor } from './ai-experiment-advisor';
import type { LandingPage } from '../types';

class MarketingInsightsService {
  /** Generate comprehensive marketing insights dashboard */
  generateInsights(pages: LandingPage[]): MarketingInsight[] {
    const insights: MarketingInsight[] = [];

    // 1. Performance insights
    insights.push(...this.performanceInsights(pages));

    // 2. Experiment insights
    insights.push(...this.experimentInsights());

    // 3. Traffic source insights
    insights.push(...this.trafficInsights(pages));

    return insights.sort((a, b) => {
      const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  /** Get executive summary */
  getExecutiveSummary(pages: LandingPage[]): {
    totalPages: number;
    activeExperiments: number;
    avgConversionRate: number;
    topPerformer: string | null;
    totalConversions: number;
    pendingSuggestions: number;
    healthScore: number;
  } {
    const scores = landingPerformanceRanker.rank(pages);
    const runningExperiments = abTestingManager.listByStatus('running');
    const suggestions = aiExperimentAdvisor.analyzeRunningExperiments();

    const avgConversion = pages.length > 0
      ? Math.round(pages.reduce((sum, p) => sum + p.analytics.conversionRate, 0) / pages.length * 100) / 100
      : 0;

    const totalConversions = pages.reduce((sum, p) => sum + p.analytics.conversions, 0);

    const healthScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length)
      : 0;

    return {
      totalPages: pages.length,
      activeExperiments: runningExperiments.length,
      avgConversionRate: avgConversion,
      topPerformer: scores.length > 0 ? scores[0].pageName : null,
      totalConversions,
      pendingSuggestions: suggestions.length,
      healthScore,
    };
  }

  // ── Private ──

  private performanceInsights(pages: LandingPage[]): MarketingInsight[] {
    const insights: MarketingInsight[] = [];
    const scores = landingPerformanceRanker.rank(pages);
    const underperformers = scores.filter(s => s.overallScore < 40);

    if (underperformers.length > 0) {
      insights.push({
        id: `ins-perf-${Date.now()}`,
        type: 'performance',
        title: `${underperformers.length} página(s) com performance abaixo do esperado`,
        summary: `As páginas ${underperformers.map(u => u.pageName).join(', ')} estão com score abaixo de 40/100 e necessitam otimização.`,
        impact: underperformers.length >= 3 ? 'critical' : 'high',
        metrics: {
          underperforming_count: underperformers.length,
          avg_score: Math.round(underperformers.reduce((s, u) => s + u.overallScore, 0) / underperformers.length),
        },
        recommendations: [
          'Iniciar A/B tests para páginas com menor score',
          'Revisar copy e CTAs com AI Conversion Designer',
          'Verificar SEO e meta tags das páginas afetadas',
        ],
        landingPageIds: underperformers.map(u => u.landingPageId),
        experimentIds: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const topPerformers = scores.filter(s => s.overallScore >= 80);
    if (topPerformers.length > 0) {
      insights.push({
        id: `ins-top-${Date.now()}`,
        type: 'performance',
        title: `${topPerformers.length} página(s) com alta performance`,
        summary: `${topPerformers.map(t => t.pageName).join(', ')} — considere usar como modelo para novas páginas.`,
        impact: 'low',
        metrics: { top_count: topPerformers.length, avg_score: Math.round(topPerformers.reduce((s, t) => s + t.overallScore, 0) / topPerformers.length) },
        recommendations: ['Usar como template para novas landing pages', 'Documentar padrões de sucesso'],
        landingPageIds: topPerformers.map(t => t.landingPageId),
        experimentIds: [],
        generatedAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  private experimentInsights(): MarketingInsight[] {
    const insights: MarketingInsight[] = [];
    const running = abTestingManager.listByStatus('running');

    for (const exp of running) {
      if (abTestingManager.hasReachedSignificance(exp.id)) {
        insights.push({
          id: `ins-exp-sig-${exp.id}`,
          type: 'experiment',
          title: `Experimento "${exp.name}" atingiu significância`,
          summary: 'Um vencedor foi identificado — ação recomendada para encerrar e escalar resultado.',
          impact: 'critical',
          metrics: { variants: exp.variants.length },
          recommendations: ['Revisar resultado e declarar vencedor', 'Escalar variante vencedora'],
          landingPageIds: [exp.landingPageId],
          experimentIds: [exp.id],
          generatedAt: new Date().toISOString(),
        });
      }
    }

    return insights;
  }

  private trafficInsights(pages: LandingPage[]): MarketingInsight[] {
    const insights: MarketingInsight[] = [];

    for (const page of pages) {
      const sources = conversionMetricsCollector.aggregateBySource(page.id);
      const highConvSources = sources.filter(s => s.rate > 5 && s.count >= 10);

      if (highConvSources.length > 0) {
        insights.push({
          id: `ins-traffic-${page.id}`,
          type: 'traffic',
          title: `Fontes de alta conversão para "${page.name}"`,
          summary: `${highConvSources.map(s => `${s.source} (${s.rate}%)`).join(', ')} — considere aumentar investimento nessas fontes.`,
          impact: 'medium',
          metrics: Object.fromEntries(highConvSources.map(s => [s.source, s.rate])),
          recommendations: ['Aumentar investimento nas fontes de alta conversão', 'Criar conteúdo específico por canal'],
          landingPageIds: [page.id],
          experimentIds: [],
          generatedAt: new Date().toISOString(),
        });
      }
    }

    return insights;
  }
}

export const marketingInsightsService = new MarketingInsightsService();
export { MarketingInsightsService };
