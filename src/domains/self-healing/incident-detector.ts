/**
 * IncidentDetector — Rule-based anomaly detection from health signals.
 *
 * Uses declarative DetectionRules evaluated against a sliding signal buffer.
 * Each rule defines conditions (signal type, count thresholds, time windows)
 * and produces an Incident with severity: minor | major | critical.
 *
 * Built-in rules:
 *  R1  module_down                              → critical
 *  R2  module_degraded + error_spike (compound) → major
 *  R3  error_spike (count ≥ threshold in window)→ major
 *  R4  error_spike (critical severity signal)   → critical
 *  R5  auth_failure_burst (≥ threshold)         → critical
 *  R6  heartbeat_lost (≥ N modules)             → critical
 *  R7  latency_spike                            → minor
 *  R8  module_degraded (standalone)             → minor
 *  R9  graph_recomp_timeout                     → major
 */

import type { HealthSignal, HealthSignalType, Incident, IncidentSeverity } from './types';

// ── Detection Rule DSL ──────────────────────────────────────────

export interface DetectionRule {
  id: string;
  /** Human label */
  name: string;
  /** The primary signal type that triggers evaluation */
  trigger: HealthSignalType;
  /** Additional signal types that must co-exist in the window (compound rules) */
  compound_with?: HealthSignalType[];
  /** Minimum count of trigger signals in the window to fire */
  count_threshold: number;
  /** Time window for counting signals (ms) */
  window_ms: number;
  /** Whether to scope counting to same source_module */
  scope_per_module: boolean;
  /** Resulting incident severity */
  severity: IncidentSeverity;
  /** Template for incident title — {module} is replaced */
  title_template: string;
  /** Template for incident description — {count}, {module}, {window_sec} replaced */
  description_template: string;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Optional: metadata condition on signal (e.g. severity === 'critical') */
  signal_filter?: (signal: HealthSignal) => boolean;
}

// ── Built-in Rules ──────────────────────────────────────────────

const BUILTIN_RULES: DetectionRule[] = [
  {
    id: 'R1_MODULE_DOWN',
    name: 'Módulo offline',
    trigger: 'module_down',
    count_threshold: 1,
    window_ms: 60_000,
    scope_per_module: true,
    severity: 'critical',
    title_template: 'Módulo offline: {module}',
    description_template: 'O módulo {module} está inacessível.',
    enabled: true,
  },
  {
    id: 'R2_DEGRADED_WITH_ERRORS',
    name: 'Módulo degradado com pico de erros',
    trigger: 'module_degraded',
    compound_with: ['error_spike'],
    count_threshold: 1,
    window_ms: 5 * 60_000,
    scope_per_module: true,
    severity: 'major',
    title_template: 'Degradação com erros: {module}',
    description_template: 'Módulo {module} está degradado e apresentando pico de erros simultâneo.',
    enabled: true,
  },
  {
    id: 'R3_ERROR_SPIKE',
    name: 'Pico de erros',
    trigger: 'error_spike',
    count_threshold: 5,
    window_ms: 5 * 60_000,
    scope_per_module: true,
    severity: 'major',
    title_template: 'Pico de erros: {module}',
    description_template: '{count} sinais de erro em {window_sec}s para {module}.',
    enabled: true,
  },
  {
    id: 'R4_CRITICAL_ERROR',
    name: 'Erro crítico detectado',
    trigger: 'error_spike',
    count_threshold: 1,
    window_ms: 60_000,
    scope_per_module: true,
    severity: 'critical',
    title_template: 'Erro crítico: {module}',
    description_template: 'Erro de severidade crítica detectado em {module}.',
    enabled: true,
    signal_filter: (s) => s.severity === 'critical',
  },
  {
    id: 'R5_AUTH_BURST',
    name: 'Surto de falhas de autenticação',
    trigger: 'auth_failure_burst',
    count_threshold: 10,
    window_ms: 60_000,
    scope_per_module: false,
    severity: 'critical',
    title_template: 'Surto de falhas de autenticação',
    description_template: '{count} falhas de auth em {window_sec}s.',
    enabled: true,
  },
  {
    id: 'R6_MULTI_HEARTBEAT_LOST',
    name: 'Múltiplos módulos sem heartbeat',
    trigger: 'heartbeat_lost',
    count_threshold: 3,
    window_ms: 3 * 60_000,
    scope_per_module: false, // count unique modules
    severity: 'critical',
    title_template: 'Múltiplos módulos sem heartbeat',
    description_template: '{count} módulos perderam heartbeat em {window_sec}s.',
    enabled: true,
  },
  {
    id: 'R7_LATENCY_SPIKE',
    name: 'Latência elevada',
    trigger: 'latency_spike',
    count_threshold: 1,
    window_ms: 5 * 60_000,
    scope_per_module: true,
    severity: 'minor',
    title_template: 'Latência elevada: {module}',
    description_template: 'Latência p95 acima do limiar para {module}.',
    enabled: true,
  },
  {
    id: 'R8_MODULE_DEGRADED',
    name: 'Módulo degradado',
    trigger: 'module_degraded',
    count_threshold: 1,
    window_ms: 60_000,
    scope_per_module: true,
    severity: 'minor',
    title_template: 'Módulo degradado: {module}',
    description_template: 'O módulo {module} está em estado degradado.',
    enabled: true,
  },
  {
    id: 'R9_GRAPH_RECOMP_TIMEOUT',
    name: 'AccessGraph recomposição lenta',
    trigger: 'graph_recomp_timeout',
    count_threshold: 3,
    window_ms: 5 * 60_000,
    scope_per_module: false,
    severity: 'major',
    title_template: 'AccessGraph lento',
    description_template: '{count} timeouts de recomposição do AccessGraph em {window_sec}s.',
    enabled: true,
  },
];

// ── Detector ────────────────────────────────────────────────────

let _idCounter = 0;

export class IncidentDetector {
  private signalBuffer: HealthSignal[] = [];
  private activeIncidentKeys = new Set<string>();
  private rules: DetectionRule[];

  constructor(customRules?: DetectionRule[]) {
    this.rules = customRules ?? [...BUILTIN_RULES];
  }

  // ── Rule management ─────────────────────────────────────────

  addRule(rule: DetectionRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) rule.enabled = true;
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) rule.enabled = false;
  }

  listRules(): DetectionRule[] {
    return [...this.rules];
  }

  // ── Detection ───────────────────────────────────────────────

  /** Ingest a signal and evaluate all rules. Returns the first matching incident or null. */
  ingest(signal: HealthSignal): Incident | null {
    this.signalBuffer.push(signal);
    // Prune old signals (>10 min)
    const cutoff = Date.now() - 10 * 60_000;
    this.signalBuffer = this.signalBuffer.filter(s => s.detected_at > cutoff);

    // Evaluate rules in order (first match wins per signal+module key)
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.trigger !== signal.type) continue;
      if (rule.signal_filter && !rule.signal_filter(signal)) continue;

      const incidentKey = `${rule.id}:${rule.scope_per_module ? signal.source_module : '*'}`;
      if (this.activeIncidentKeys.has(incidentKey)) continue;

      const matched = this.evaluateRule(rule, signal);
      if (matched) {
        this.activeIncidentKeys.add(incidentKey);
        return matched;
      }
    }

    return null;
  }

  clearIncidentKey(key: string) {
    // Clear all keys that contain the signal type + module
    const toRemove = [...this.activeIncidentKeys].filter(k => k.includes(key));
    for (const k of toRemove) this.activeIncidentKeys.delete(k);
    // Also try exact match
    this.activeIncidentKeys.delete(key);
  }

  // ── Private ─────────────────────────────────────────────────

  private evaluateRule(rule: DetectionRule, signal: HealthSignal): Incident | null {
    const now = Date.now();
    const windowStart = now - rule.window_ms;

    // Count matching signals in window
    let matchingSignals = this.signalBuffer.filter(s => {
      if (s.type !== rule.trigger) return false;
      if (s.detected_at < windowStart) return false;
      if (rule.scope_per_module && s.source_module !== signal.source_module) return false;
      if (rule.signal_filter && !rule.signal_filter(s)) return false;
      return true;
    });

    // For heartbeat_lost with scope_per_module=false, count unique modules
    if (!rule.scope_per_module && rule.trigger === 'heartbeat_lost') {
      const uniqueModules = new Set(matchingSignals.map(s => s.source_module));
      if (uniqueModules.size < rule.count_threshold) return null;
      const modules = [...uniqueModules];
      return this.buildIncident(rule, matchingSignals, modules, signal);
    }

    if (matchingSignals.length < rule.count_threshold) return null;

    // Compound rule: check that compound signals also exist in window
    if (rule.compound_with?.length) {
      const hasCompound = rule.compound_with.every(compType =>
        this.signalBuffer.some(s =>
          s.type === compType &&
          s.detected_at >= windowStart &&
          (!rule.scope_per_module || s.source_module === signal.source_module)
        ),
      );
      if (!hasCompound) return null;
    }

    const affectedModules = rule.scope_per_module
      ? [signal.source_module]
      : [...new Set(matchingSignals.map(s => s.source_module))];

    return this.buildIncident(rule, matchingSignals, affectedModules, signal);
  }

  private buildIncident(
    rule: DetectionRule,
    signals: HealthSignal[],
    modules: string[],
    triggerSignal: HealthSignal,
  ): Incident {
    const replacements: Record<string, string> = {
      '{module}': triggerSignal.source_module,
      '{count}': String(signals.length),
      '{window_sec}': String(Math.round(rule.window_ms / 1000)),
    };

    const replace = (template: string) =>
      Object.entries(replacements).reduce((t, [k, v]) => t.split(k).join(v), template);

    return {
      id: `inc_${++_idCounter}_${Date.now()}`,
      title: replace(rule.title_template),
      description: replace(rule.description_template),
      severity: rule.severity,
      status: 'detected',
      signals,
      affected_modules: modules,
      recovery_actions: [],
      detected_at: Date.now(),
      resolved_at: null,
      auto_recovered: false,
    };
  }
}
