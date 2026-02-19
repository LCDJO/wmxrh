/**
 * BehaviorPatternAnalyzer — Detects usage patterns and anomalies from collected signals.
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
