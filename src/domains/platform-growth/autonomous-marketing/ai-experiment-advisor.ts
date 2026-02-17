/**
 * AIExperimentAdvisor — Uses heuristics and AI signals to recommend
 * experiment actions: new tests, early stops, scaling winners.
 */
import type { ExperimentSuggestion, ABExperiment, LandingPerformanceScore } from './types';
import { abTestingManager } from './ab-testing-manager';
import { conversionAnalyzer } from './conversion-analyzer';

class AIExperimentAdvisor {
  /** Generate suggestions for running experiments */
  analyzeRunningExperiments(): ExperimentSuggestion[] {
    const running = abTestingManager.listByStatus('running');
    const suggestions: ExperimentSuggestion[] = [];

    for (const exp of running) {
      suggestions.push(...this.analyzeExperiment(exp));
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /** Suggest new experiments for underperforming pages */
  suggestNewExperiments(performanceScores: LandingPerformanceScore[]): ExperimentSuggestion[] {
    return performanceScores
      .filter(s => s.overallScore < 50 && s.trend !== 'improving')
      .map(score => ({
        id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        experimentId: null,
        landingPageId: score.landingPageId,
        type: 'new_experiment' as const,
        title: `Testar variações para "${score.pageName}"`,
        description: `A página "${score.pageName}" tem score ${score.overallScore}/100 e tendência ${score.trend}. Recomendamos iniciar um A/B test para melhorar a conversão.`,
        rationale: this.buildRationale(score),
        predictedLift: Math.max(5, Math.round((100 - score.overallScore) * 0.3)),
        confidence: Math.min(85, 50 + (100 - score.overallScore) * 0.3),
        priority: score.overallScore < 25 ? 'critical' as const : 'high' as const,
        suggestedActions: this.suggestActions(score),
        createdAt: new Date().toISOString(),
      }));
  }

  // ── Private ──

  private analyzeExperiment(exp: ABExperiment): ExperimentSuggestion[] {
    const suggestions: ExperimentSuggestion[] = [];

    try {
      const analysis = conversionAnalyzer.analyzeExperiment(exp.id);

      // Check for clear winner
      if (analysis.suggestedWinner) {
        const winner = analysis.results.find(r => r.variant.id === analysis.suggestedWinner);
        if (winner) {
          suggestions.push({
            id: `sug-${Date.now()}-win`,
            experimentId: exp.id,
            landingPageId: exp.landingPageId,
            type: 'scale_winner',
            title: `Escalar vencedor: ${winner.variant.name}`,
            description: `A variante "${winner.variant.name}" apresenta lift de ${winner.lift}% com ${winner.confidence}% de confiança.`,
            rationale: `Significância estatística atingida. Confidence: ${winner.confidence}%, Target: ${exp.confidenceLevel}%.`,
            predictedLift: winner.lift,
            confidence: winner.confidence,
            priority: 'critical',
            suggestedActions: [
              'Encerrar experimento e declarar vencedor',
              'Aplicar variações da variante vencedora à página principal',
              'Documentar aprendizados para próximos testes',
            ],
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Check for underperformers
      for (const result of analysis.results) {
        if (result.significant && result.lift < -10) {
          suggestions.push({
            id: `sug-${Date.now()}-rem-${result.variant.id}`,
            experimentId: exp.id,
            landingPageId: exp.landingPageId,
            type: 'iterate_variant',
            title: `Remover variante fraca: ${result.variant.name}`,
            description: `Variante "${result.variant.name}" tem lift negativo de ${result.lift}% com significância.`,
            rationale: 'Performance significativamente pior que o controle.',
            predictedLift: Math.abs(result.lift) * 0.3,
            confidence: result.confidence,
            priority: 'medium',
            suggestedActions: ['Remover variante e redistribuir tráfego'],
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Check for stale experiments (running too long without significance)
      const daysSinceStart = exp.startedAt
        ? (Date.now() - new Date(exp.startedAt).getTime()) / 86400000
        : 0;

      if (daysSinceStart > 30 && !analysis.suggestedWinner) {
        suggestions.push({
          id: `sug-${Date.now()}-stale`,
          experimentId: exp.id,
          landingPageId: exp.landingPageId,
          type: 'stop_experiment',
          title: `Experimento sem resultado após ${Math.round(daysSinceStart)} dias`,
          description: 'O teste está rodando há mais de 30 dias sem atingir significância estatística.',
          rationale: 'Considere que não há diferença real entre as variantes ou que o tráfego é insuficiente.',
          predictedLift: 0,
          confidence: 50,
          priority: 'medium',
          suggestedActions: [
            'Encerrar sem vencedor (inconcluso)',
            'Aumentar tráfego alocado ao experimento',
            'Criar variantes com diferenças mais agressivas',
          ],
          createdAt: new Date().toISOString(),
        });
      }
    } catch { /* experiment analysis failed, skip */ }

    return suggestions;
  }

  private buildRationale(score: LandingPerformanceScore): string {
    const weak: string[] = [];
    if (score.conversionScore < 30) weak.push('conversão baixa');
    if (score.engagementScore < 30) weak.push('engajamento fraco');
    if (score.revenueScore < 20) weak.push('receita baixa');
    if (score.seoScore < 40) weak.push('SEO deficiente');
    return `Pontos fracos identificados: ${weak.join(', ') || 'score geral abaixo do esperado'}.`;
  }

  private suggestActions(score: LandingPerformanceScore): string[] {
    const actions: string[] = [];
    if (score.conversionScore < 30) actions.push('Testar novos CTAs e headlines');
    if (score.engagementScore < 30) actions.push('Testar layout e ordem dos blocos');
    if (score.seoScore < 40) actions.push('Adicionar FAQ e melhorar meta tags');
    if (score.revenueScore < 20) actions.push('Testar diferentes ofertas e planos em destaque');
    if (actions.length === 0) actions.push('Testar variações incrementais de copy e design');
    return actions;
  }
}

export const aiExperimentAdvisor = new AIExperimentAdvisor();
export { AIExperimentAdvisor };
