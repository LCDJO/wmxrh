/**
 * BehaviorPatternAnalyzer — Detects usage patterns and anomalies from collected signals.
 *
 * Patterns detected:
 *  - error_burst          → alta taxa de erros em janela curta
 *  - usage_spike          → pico de uso acima da média por módulo
 *  - security_anomaly     → sinais de identidade/segurança anômalos
 *  - churn_risk           → tenant com queda de atividade + erros
 *  - workflow_failure      → workflows com falhas recorrentes
 *  - conversion_decline   → landing pages com queda de conversão
 *  - latency_degradation  → módulos com latência elevada
 */

import type { PlatformSignal, BehaviorPattern, PatternType } from './types';
import { PlatformSignalCollector } from './platform-signal-collector';

let _patternSeq = 0;

function detectPatterns(signals: PlatformSignal[]): BehaviorPattern[] {
  const patterns: BehaviorPattern[] = [];
  if (signals.length === 0) return patterns;

  // ── Error burst detection ──
  const errorSignals = signals.filter(s => s.severity === 'critical' || s.severity === 'warning');
  const errorRate = errorSignals.length / Math.max(signals.length, 1);
  if (errorRate > 0.15 && errorSignals.length >= 3) {
    const affectedModules = [...new Set(errorSignals.map(s => s.module_key).filter(Boolean))] as string[];
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'error_burst',
      confidence: Math.min(95, Math.round(errorRate * 200)),
      affected_tenants: [...new Set(errorSignals.map(s => s.tenant_id).filter(Boolean))] as string[],
      affected_modules: affectedModules,
      description: `Rajada de erros detectada: ${errorSignals.length} sinais de alerta em ${signals.length} totais (${(errorRate * 100).toFixed(1)}%)`,
      detected_at: new Date().toISOString(),
      data_points: errorSignals.length,
      trend_direction: 'up',
    });
  }

  // ── Usage spike by module ──
  const moduleCounts: Record<string, number> = {};
  for (const s of signals) {
    if (s.module_key) moduleCounts[s.module_key] = (moduleCounts[s.module_key] || 0) + 1;
  }
  const avgPerModule = signals.length / Math.max(Object.keys(moduleCounts).length, 1);
  for (const [mod, count] of Object.entries(moduleCounts)) {
    if (count > avgPerModule * 2.5 && count >= 5) {
      patterns.push({
        id: `pat_${++_patternSeq}`,
        type: 'usage_spike',
        confidence: Math.min(90, Math.round((count / avgPerModule) * 25)),
        affected_tenants: [],
        affected_modules: [mod],
        description: `Pico de uso no módulo "${mod}": ${count} sinais (média: ${avgPerModule.toFixed(0)})`,
        detected_at: new Date().toISOString(),
        data_points: count,
        trend_direction: 'up',
      });
    }
  }

  // ── Security anomaly ──
  const secSignals = signals.filter(s => s.source === 'identity' && s.severity !== 'info');
  if (secSignals.length >= 3) {
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'security_anomaly',
      confidence: Math.min(85, secSignals.length * 15),
      affected_tenants: [...new Set(secSignals.map(s => s.tenant_id).filter(Boolean))] as string[],
      affected_modules: [],
      description: `${secSignals.length} sinais de identidade/segurança não-informativos detectados`,
      detected_at: new Date().toISOString(),
      data_points: secSignals.length,
      trend_direction: 'up',
    });
  }

  // ── Churn risk — tenant com queda de atividade + erros ──
  const tenantActivity: Record<string, { total: number; errors: number }> = {};
  for (const s of signals) {
    if (!s.tenant_id) continue;
    if (!tenantActivity[s.tenant_id]) tenantActivity[s.tenant_id] = { total: 0, errors: 0 };
    tenantActivity[s.tenant_id].total++;
    if (s.severity === 'critical' || s.severity === 'warning') tenantActivity[s.tenant_id].errors++;
  }
  const avgTenantActivity = Object.values(tenantActivity).reduce((s, t) => s + t.total, 0) / Math.max(Object.keys(tenantActivity).length, 1);
  for (const [tid, stats] of Object.entries(tenantActivity)) {
    const errorRatio = stats.errors / Math.max(stats.total, 1);
    const belowAvg = stats.total < avgTenantActivity * 0.4;
    if (belowAvg && errorRatio > 0.3 && stats.errors >= 2) {
      patterns.push({
        id: `pat_${++_patternSeq}`,
        type: 'churn_risk',
        confidence: Math.min(88, Math.round(errorRatio * 100 + (belowAvg ? 20 : 0))),
        affected_tenants: [tid],
        affected_modules: [],
        description: `Risco de churn: tenant ${tid.slice(0, 8)}… com atividade ${stats.total} (média: ${avgTenantActivity.toFixed(0)}) e ${(errorRatio * 100).toFixed(0)}% de erros`,
        detected_at: new Date().toISOString(),
        data_points: stats.total,
        trend_direction: 'down',
      });
    }
  }

  // ── Workflow failure — workflows com falhas recorrentes ──
  const wfFailures = signals.filter(s =>
    s.source === 'automation' && s.event_type.includes('failed') && s.severity === 'critical'
  );
  if (wfFailures.length >= 2) {
    const wfIds = [...new Set(wfFailures.map(s => (s.payload as any)?.workflow_id).filter(Boolean))] as string[];
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'error_burst',
      confidence: Math.min(92, wfFailures.length * 20),
      affected_tenants: [...new Set(wfFailures.map(s => s.tenant_id).filter(Boolean))] as string[],
      affected_modules: ['integration-automation'],
      description: `Falhas recorrentes em workflows: ${wfFailures.length} falhas em ${wfIds.length} workflow(s)`,
      detected_at: new Date().toISOString(),
      data_points: wfFailures.length,
      trend_direction: 'up',
    });
  }

  // ── Conversion decline — landing pages com queda de conversão ──
  const conversionSignals = signals.filter(s =>
    s.event_type === 'growth:ConversionTracked' && s.module_key === 'landing-engine'
  );
  const insightSignals = signals.filter(s =>
    s.event_type === 'growth:GrowthInsightGenerated' && s.severity !== 'info'
  );
  if (insightSignals.length >= 2 && conversionSignals.length < 3) {
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'usage_decline' as PatternType,
      confidence: Math.min(78, 40 + insightSignals.length * 12),
      affected_tenants: [],
      affected_modules: ['landing-engine'],
      description: `Queda de conversão detectada: ${insightSignals.length} alertas de growth com apenas ${conversionSignals.length} conversões no período`,
      detected_at: new Date().toISOString(),
      data_points: insightSignals.length + conversionSignals.length,
      trend_direction: 'down',
    });
  }

  // ── Latency degradation — módulos com alta latência ──
  const latencySignals = signals.filter(s =>
    s.event_type.includes('latency_spike') || s.event_type.includes('latency_degradation')
  );
  if (latencySignals.length >= 2) {
    const latencyModules = [...new Set(latencySignals.map(s => s.module_key).filter(Boolean))] as string[];
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'latency_degradation',
      confidence: Math.min(85, latencySignals.length * 18),
      affected_tenants: [...new Set(latencySignals.map(s => s.tenant_id).filter(Boolean))] as string[],
      affected_modules: latencyModules,
      description: `Degradação de latência em ${latencyModules.length} módulo(s): ${latencySignals.length} spikes detectados`,
      detected_at: new Date().toISOString(),
      data_points: latencySignals.length,
      trend_direction: 'up',
    });
  }

  // ── API rate limit abuse ──
  const rateLimitSignals = signals.filter(s =>
    s.source === 'api' && (s.event_type.includes('rate_limit') || s.event_type.includes('scope_violation'))
  );
  if (rateLimitSignals.length >= 3) {
    patterns.push({
      id: `pat_${++_patternSeq}`,
      type: 'security_anomaly',
      confidence: Math.min(82, rateLimitSignals.length * 14),
      affected_tenants: [...new Set(rateLimitSignals.map(s => s.tenant_id).filter(Boolean))] as string[],
      affected_modules: ['api-management'],
      description: `Abuso de API detectado: ${rateLimitSignals.length} violações de rate limit/scope`,
      detected_at: new Date().toISOString(),
      data_points: rateLimitSignals.length,
      trend_direction: 'up',
    });
  }

  return patterns;
}

export const BehaviorPatternAnalyzer = {
  /** Analyze recent signals and detect patterns */
  analyze(hours: number = 24): BehaviorPattern[] {
    const signals = PlatformSignalCollector.getRecent(hours);
    return detectPatterns(signals);
  },

  /** Analyze a specific set of signals */
  analyzeSignals(signals: PlatformSignal[]): BehaviorPattern[] {
    return detectPatterns(signals);
  },
};
