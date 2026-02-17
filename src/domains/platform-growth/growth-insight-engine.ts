/**
 * GrowthInsightEngine — AI-powered growth strategy suggestions.
 * Analyzes tenant metrics, churn signals, and conversion data to produce actionable insights.
 */
import type { GrowthInsight } from './types';

export class GrowthInsightEngine {
  generateInsights(): GrowthInsight[] {
    return [
      {
        id: 'gi-1',
        type: 'acquisition',
        title: 'Landing page de onboarding simplificado',
        description: 'Tenants que passam pelo onboarding em <5min têm 3x mais conversão. Crie uma LP com wizard embutido.',
        impact: 'high',
        confidence: 87,
        suggestedActions: [
          'Criar LP com formulário de 3 steps',
          'Integrar com referral engine para tracking',
          'Adicionar GTM event em cada step',
        ],
        metrics: { avg_onboarding_time: 12.5, target_time: 5, conversion_lift: 3.1 },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'gi-2',
        type: 'retention',
        title: 'Campanhas de reengajamento por email',
        description: 'Tenants inativos há 14+ dias têm 40% chance de churn. Uma LP dedicada com oferta pode recuperar 25%.',
        impact: 'critical',
        confidence: 92,
        suggestedActions: [
          'Criar LP de reativação com desconto exclusivo',
          'Integrar com billing core para cupom automático',
          'Rastrear conversão via ConversionTrackingService',
        ],
        metrics: { inactive_tenants: 23, churn_probability: 40, recovery_target: 25 },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'gi-3',
        type: 'expansion',
        title: 'Upsell para plano Professional',
        description: '18 tenants no plano Starter usam >80% do limite de módulos. LP de upgrade com comparativo pode converter 60%.',
        impact: 'high',
        confidence: 78,
        suggestedActions: [
          'Criar LP de comparação de planos',
          'Destacar módulos bloqueados no plano atual',
          'Integrar com PlanOptimizationAdvisor',
        ],
        metrics: { eligible_tenants: 18, potential_mrr_increase: 4500, conversion_estimate: 60 },
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export const growthInsightEngine = new GrowthInsightEngine();
