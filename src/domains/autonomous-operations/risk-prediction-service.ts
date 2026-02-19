/**
 * RiskPredictionService — Predicts operational, financial, compliance, security, and performance risks.
 *
 * Predictions:
 *  - Impacto de novas versões em tenants
 *  - Conflitos de módulos
 *  - Aumento de carga na API
 *  - Riscos operacionais, financeiros e de segurança baseados em padrões
 */

import type { PlatformSignal, PredictedRisk, RiskCategory, BehaviorPattern } from './types';
import { PlatformSignalCollector } from './platform-signal-collector';

let _riskSeq = 0;

// ══════════════════════════════════════════════
// Pattern-based risk prediction
// ══════════════════════════════════════════════

function riskFromPattern(pattern: BehaviorPattern): PredictedRisk | null {
  const categoryMap: Record<string, RiskCategory> = {
    error_burst: 'operational',
    latency_degradation: 'performance',
    security_anomaly: 'security',
    churn_risk: 'financial',
    cost_anomaly: 'financial',
    usage_decline: 'operational',
    usage_spike: 'performance',
  };

  const category = categoryMap[pattern.type];
  if (!category) return null;

  const probability = Math.min(95, pattern.confidence);
  const impact = pattern.type === 'security_anomaly' ? 85
    : pattern.type === 'error_burst' ? 75
    : pattern.type === 'latency_degradation' ? 70
    : 55;
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
    case 'usage_spike':
      return ['Monitorar capacidade de infraestrutura', 'Preparar auto-scale', 'Verificar se é uso legítimo ou abuso'];
    default:
      return ['Investigar sinais recentes', 'Monitorar tendência nas próximas horas'];
  }
}

// ══════════════════════════════════════════════
// Version impact prediction
// ══════════════════════════════════════════════

function predictVersionImpact(signals: PlatformSignal[]): PredictedRisk[] {
  const risks: PredictedRisk[] = [];

  // Detect recent version deployments followed by error signals
  const versionSignals = signals.filter(s =>
    s.event_type.includes('version_published') || s.event_type.includes('version_rollback')
  );
  const postDeployErrors = signals.filter(s =>
    (s.severity === 'critical' || s.severity === 'warning') &&
    s.source !== 'identity'
  );

  if (versionSignals.length > 0 && postDeployErrors.length >= 3) {
    const affectedModules = [...new Set([
      ...versionSignals.map(s => s.module_key),
      ...postDeployErrors.map(s => s.module_key),
    ].filter(Boolean))] as string[];

    const probability = Math.min(90, 40 + postDeployErrors.length * 10);
    risks.push({
      id: `risk_${++_riskSeq}`,
      category: 'operational',
      title: 'Impacto de nova versão detectado',
      description: `${postDeployErrors.length} erros após deploy de ${versionSignals.length} versão(ões). Módulos: ${affectedModules.join(', ')}`,
      probability,
      impact_score: 75,
      composite_score: Math.round((probability * 75) / 100),
      affected_area: affectedModules[0] || 'plataforma',
      mitigation_steps: [
        'Analisar changelog da versão deployada',
        'Comparar métricas pré e pós-deploy',
        'Considerar rollback se erros persistirem',
        'Isolar tenant mais impactado para análise',
      ],
      predicted_at: new Date().toISOString(),
      horizon_hours: 6,
    });
  }

  return risks;
}

// ══════════════════════════════════════════════
// Module conflict prediction
// ══════════════════════════════════════════════

function predictModuleConflicts(signals: PlatformSignal[]): PredictedRisk[] {
  const risks: PredictedRisk[] = [];

  // Group errors by module, check for correlated failures across modules
  const moduleErrors: Record<string, PlatformSignal[]> = {};
  for (const s of signals) {
    if (s.module_key && (s.severity === 'critical' || s.severity === 'warning')) {
      if (!moduleErrors[s.module_key]) moduleErrors[s.module_key] = [];
      moduleErrors[s.module_key].push(s);
    }
  }

  const failingModules = Object.entries(moduleErrors).filter(([, errs]) => errs.length >= 2);

  if (failingModules.length >= 2) {
    const moduleNames = failingModules.map(([m]) => m);
    const totalErrors = failingModules.reduce((sum, [, e]) => sum + e.length, 0);
    const probability = Math.min(85, 30 + failingModules.length * 15);

    risks.push({
      id: `risk_${++_riskSeq}`,
      category: 'operational',
      title: 'Conflito entre módulos detectado',
      description: `Falhas correlacionadas em ${failingModules.length} módulos (${moduleNames.join(', ')}): ${totalErrors} erros simultâneos`,
      probability,
      impact_score: 70,
      composite_score: Math.round((probability * 70) / 100),
      affected_area: moduleNames.join(', '),
      mitigation_steps: [
        'Verificar dependências compartilhadas entre módulos',
        'Analisar ordem de inicialização e race conditions',
        'Isolar módulos com sandbox para teste independente',
        'Verificar se há circular dependency ou evento em loop',
      ],
      predicted_at: new Date().toISOString(),
      horizon_hours: 12,
    });
  }

  return risks;
}

// ══════════════════════════════════════════════
// API load increase prediction
// ══════════════════════════════════════════════

function predictApiLoadIncrease(signals: PlatformSignal[]): PredictedRisk[] {
  const risks: PredictedRisk[] = [];

  const apiSignals = signals.filter(s => s.source === 'api');
  const rateLimitSignals = apiSignals.filter(s => s.event_type.includes('rate_limit'));
  const totalApiSignals = apiSignals.length;

  // High API activity with rate limiting = capacity concern
  if (totalApiSignals >= 10 && rateLimitSignals.length >= 2) {
    const rateLimitPct = (rateLimitSignals.length / totalApiSignals) * 100;
    const probability = Math.min(90, 40 + Math.round(rateLimitPct * 2));

    risks.push({
      id: `risk_${++_riskSeq}`,
      category: 'performance',
      title: 'Aumento de carga na API previsto',
      description: `${totalApiSignals} chamadas de API com ${rateLimitSignals.length} violações de rate limit (${rateLimitPct.toFixed(1)}%). Tendência de aumento de carga.`,
      probability,
      impact_score: 65,
      composite_score: Math.round((probability * 65) / 100),
      affected_area: 'api-management',
      mitigation_steps: [
        'Revisar limites de rate limiting por plano',
        'Identificar clientes com consumo anômalo',
        'Considerar upgrade de infraestrutura de API gateway',
        'Implementar cache de resposta para endpoints frequentes',
      ],
      predicted_at: new Date().toISOString(),
      horizon_hours: 8,
    });
  }

  // Scope violations = potential abuse or misconfiguration
  const scopeViolations = apiSignals.filter(s => s.event_type.includes('scope_violation'));
  if (scopeViolations.length >= 3) {
    const affectedTenants = [...new Set(scopeViolations.map(s => s.tenant_id).filter(Boolean))] as string[];
    risks.push({
      id: `risk_${++_riskSeq}`,
      category: 'security',
      title: 'Violações de escopo de API recorrentes',
      description: `${scopeViolations.length} tentativas de acesso a escopos não autorizados por ${affectedTenants.length} tenant(s)`,
      probability: Math.min(80, scopeViolations.length * 15),
      impact_score: 80,
      composite_score: Math.round((Math.min(80, scopeViolations.length * 15) * 80) / 100),
      affected_area: 'api-management',
      mitigation_steps: [
        'Auditar permissões dos API clients envolvidos',
        'Verificar se é misconfiguration ou tentativa de abuso',
        'Considerar suspensão temporária de clients suspeitos',
        'Revisar documentação de escopos disponíveis',
      ],
      predicted_at: new Date().toISOString(),
      horizon_hours: 4,
    });
  }

  return risks;
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

export const RiskPredictionService = {
  /** Predict risks from behavior patterns */
  predict(patterns: BehaviorPattern[]): PredictedRisk[] {
    return patterns.map(riskFromPattern).filter(Boolean) as PredictedRisk[];
  },

  /** Predict risks directly from signals (heuristic + domain-specific) */
  predictFromSignals(signals: PlatformSignal[]): PredictedRisk[] {
    const risks: PredictedRisk[] = [];

    // Critical signal density → operational risk
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

    // Domain-specific predictions
    risks.push(...predictVersionImpact(signals));
    risks.push(...predictModuleConflicts(signals));
    risks.push(...predictApiLoadIncrease(signals));

    return risks;
  },

  /** Full prediction: patterns + signals combined */
  predictAll(patterns: BehaviorPattern[], hours: number = 24): PredictedRisk[] {
    const signals = PlatformSignalCollector.getRecent(hours);
    return [
      ...this.predict(patterns),
      ...this.predictFromSignals(signals),
    ];
  },
};
