/**
 * RiskPredictionService — Predicts operational, financial, compliance, security, and performance risks.
 */

import type { PlatformSignal, PredictedRisk, RiskCategory, BehaviorPattern } from './types';

let _riskSeq = 0;

function riskFromPattern(pattern: BehaviorPattern): PredictedRisk | null {
  const categoryMap: Record<string, RiskCategory> = {
    error_burst: 'operational',
    latency_degradation: 'performance',
    security_anomaly: 'security',
    churn_risk: 'financial',
    cost_anomaly: 'financial',
    usage_decline: 'operational',
  };

  const category = categoryMap[pattern.type];
  if (!category) return null;

  const probability = Math.min(95, pattern.confidence);
  const impact = pattern.type === 'security_anomaly' ? 85 : pattern.type === 'error_burst' ? 75 : 55;
  const composite = Math.round((probability * impact) / 100);

  return {
    id: `risk_${++_riskSeq}`,
    category,
    title: `Risco previsto: ${pattern.type.replace(/_/g, ' ')}`,
    description: pattern.description,
    probability,
    impact_score: impact,
    composite_score: composite,
    affected_area: pattern.affected_modules[0] || 'plataforma',
    mitigation_steps: getMitigationSteps(pattern.type),
    predicted_at: new Date().toISOString(),
    horizon_hours: pattern.type === 'error_burst' ? 4 : 24,
  };
}

function getMitigationSteps(type: string): string[] {
  switch (type) {
    case 'error_burst':
      return ['Verificar logs do módulo afetado', 'Ativar self-healing automático', 'Escalar para engenharia se persistir'];
    case 'security_anomaly':
      return ['Revisar tentativas de acesso recentes', 'Verificar sessões ativas de impersonation', 'Bloquear IPs suspeitos'];
    case 'churn_risk':
      return ['Contatar tenant proativamente', 'Oferecer extensão de trial ou desconto', 'Analisar padrão de uso recente'];
    case 'latency_degradation':
      return ['Verificar uso de recursos do servidor', 'Analisar queries lentas', 'Considerar escalonamento horizontal'];
    case 'cost_anomaly':
      return ['Auditar consumo de recursos por tenant', 'Verificar jobs em loop', 'Revisar limites de rate limiting'];
    default:
      return ['Investigar sinais recentes', 'Monitorar tendência nas próximas horas'];
  }
}

export const RiskPredictionService = {
  /** Predict risks from behavior patterns */
  predict(patterns: BehaviorPattern[]): PredictedRisk[] {
    return patterns.map(riskFromPattern).filter(Boolean) as PredictedRisk[];
  },

  /** Predict risks directly from signals */
  predictFromSignals(signals: PlatformSignal[]): PredictedRisk[] {
    // Quick heuristic: high critical signal density = operational risk
    const risks: PredictedRisk[] = [];
    const criticals = signals.filter(s => s.severity === 'critical');

    if (criticals.length >= 5) {
      risks.push({
        id: `risk_${++_riskSeq}`,
        category: 'operational',
        title: 'Alta densidade de sinais críticos',
        description: `${criticals.length} sinais críticos nas últimas horas indicam instabilidade operacional`,
        probability: Math.min(95, criticals.length * 10),
        impact_score: 80,
        composite_score: Math.min(95, Math.round((criticals.length * 10 * 80) / 100)),
        affected_area: 'plataforma',
        mitigation_steps: ['Ativar modo de contenção', 'Pausar deploys', 'Escalar para SRE'],
        predicted_at: new Date().toISOString(),
        horizon_hours: 2,
      });
    }

    return risks;
  },
};
