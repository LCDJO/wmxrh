/**
 * GovernanceCoreEngine — Predictive Alert Engine
 *
 * Evaluates employee disciplinary history against configurable thresholds
 * and generates executive alerts when risk patterns are detected.
 *
 * Default rules (tenant-overridable):
 *   - escalation_risk: ≥2 warnings + ≥1 suspension
 *   - termination_risk: risk_score > threshold (default 70)
 *   - legal_exposure:   contested sanctions + pending decisions
 *   - pattern_detected: repeated infractions within sliding window
 *
 * Integrates with:
 *   - GovernanceProjectionStore (employee disciplinary projections)
 *   - GovernanceEventBus (reacts to lifecycle events)
 *   - governance_executive_alerts (persistence)
 *   - governance_alert_configs (tenant rules)
 */

import { supabase } from '@/integrations/supabase/client';
import { onGovernanceEvent } from '../events/governance-event-bus';
import { EMPLOYEE_LIFECYCLE_EVENTS } from '../events/employee-lifecycle-events';
import { SANCTION_EVENTS } from '../events/sanction-events';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';
import type { Json } from '@/integrations/supabase/types';

const projectionStore = new GovernanceProjectionStore();

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type AlertType = 'escalation_risk' | 'termination_risk' | 'legal_exposure' | 'pattern_detected';
export type AlertSeverity = 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

export interface TriggerFactor {
  factor: string;
  value: number | string;
  threshold: number | string;
  description: string;
}

export interface ExecutiveAlert {
  id: string;
  tenant_id: string;
  employee_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  trigger_factors: TriggerFactor[];
  risk_score: number;
  recommended_actions: string[];
  status: AlertStatus;
  created_at: string;
}

export interface AlertRuleConfig {
  rule_code: string;
  rule_name: string;
  is_active: boolean;
  conditions: AlertConditions;
  severity: AlertSeverity;
  notify_channels: string[];
}

export interface AlertConditions {
  min_warnings?: number;
  min_suspensions?: number;
  risk_score_threshold?: number;
  min_contested_sanctions?: number;
  min_pending_decisions?: number;
  sliding_window_days?: number;
  min_infractions_in_window?: number;
}

// ══════════════════════════════════════════════
// DEFAULT RULES
// ══════════════════════════════════════════════

const DEFAULT_RULES: AlertRuleConfig[] = [
  {
    rule_code: 'escalation_risk',
    rule_name: 'Risco de Escalonamento Disciplinar',
    is_active: true,
    conditions: { min_warnings: 2, min_suspensions: 1 },
    severity: 'high',
    notify_channels: ['in_app'],
  },
  {
    rule_code: 'termination_risk',
    rule_name: 'Risco de Desligamento por Justa Causa',
    is_active: true,
    conditions: { risk_score_threshold: 70 },
    severity: 'critical',
    notify_channels: ['in_app', 'email'],
  },
  {
    rule_code: 'legal_exposure',
    rule_name: 'Exposição Jurídica Elevada',
    is_active: true,
    conditions: { min_contested_sanctions: 1, min_pending_decisions: 1 },
    severity: 'high',
    notify_channels: ['in_app'],
  },
  {
    rule_code: 'pattern_detected',
    rule_name: 'Padrão Reincidente Detectado',
    is_active: true,
    conditions: { sliding_window_days: 90, min_infractions_in_window: 3 },
    severity: 'high',
    notify_channels: ['in_app'],
  },
];

// ══════════════════════════════════════════════
// ALERT ENGINE
// ══════════════════════════════════════════════

export class AlertEngine {
  // ── Rule config management ──

  async getRules(tenantId: string): Promise<AlertRuleConfig[]> {
    const { data } = await supabase
      .from('governance_alert_configs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (!data || data.length === 0) return DEFAULT_RULES;

    const tenantRules = data.map(r => ({
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      is_active: r.is_active,
      conditions: r.conditions as unknown as AlertConditions,
      severity: r.severity as AlertSeverity,
      notify_channels: r.notify_channels as unknown as string[],
    }));

    // Merge: tenant overrides + defaults for missing rules
    const codes = new Set(tenantRules.map(r => r.rule_code));
    return [...tenantRules, ...DEFAULT_RULES.filter(d => !codes.has(d.rule_code))];
  }

  async saveRule(tenantId: string, rule: AlertRuleConfig, createdBy?: string): Promise<void> {
    const { error } = await supabase
      .from('governance_alert_configs')
      .upsert({
        tenant_id: tenantId,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        is_active: rule.is_active,
        conditions: rule.conditions as unknown as Json,
        severity: rule.severity,
        notify_channels: rule.notify_channels as unknown as Json,
        created_by: createdBy ?? null,
      }, { onConflict: 'tenant_id,rule_code' });

    if (error) throw new Error(`[AlertEngine] Rule save failed: ${error.message}`);
  }

  // ── Core evaluation ──

  async evaluateEmployee(tenantId: string, employeeId: string): Promise<ExecutiveAlert[]> {
    const rules = await this.getRules(tenantId);
    const activeRules = rules.filter(r => r.is_active);
    if (activeRules.length === 0) return [];

    // Load employee disciplinary profile from projections
    const profile = await this.loadEmployeeProfile(tenantId, employeeId);
    const alerts: ExecutiveAlert[] = [];

    for (const rule of activeRules) {
      const result = this.evaluateRule(rule, profile, tenantId, employeeId);
      if (result) alerts.push(result);
    }

    // Persist new alerts (skip duplicates within 24h)
    if (alerts.length > 0) {
      await this.persistAlerts(tenantId, employeeId, alerts);
    }

    return alerts;
  }

  private evaluateRule(
    rule: AlertRuleConfig,
    profile: EmployeeProfile,
    tenantId: string,
    employeeId: string,
  ): ExecutiveAlert | null {
    const c = rule.conditions;
    const factors: TriggerFactor[] = [];

    switch (rule.rule_code) {
      case 'escalation_risk': {
        const warningsMet = profile.warning_count >= (c.min_warnings ?? 2);
        const suspensionsMet = profile.suspension_count >= (c.min_suspensions ?? 1);
        if (warningsMet) factors.push({ factor: 'warnings', value: profile.warning_count, threshold: c.min_warnings ?? 2, description: `${profile.warning_count} advertências registradas` });
        if (suspensionsMet) factors.push({ factor: 'suspensions', value: profile.suspension_count, threshold: c.min_suspensions ?? 1, description: `${profile.suspension_count} suspensão(ões) registrada(s)` });
        if (!warningsMet || !suspensionsMet) return null;
        break;
      }
      case 'termination_risk': {
        const threshold = c.risk_score_threshold ?? 70;
        if (profile.risk_score < threshold) return null;
        factors.push({ factor: 'risk_score', value: profile.risk_score, threshold, description: `Score de risco ${profile.risk_score} excede limiar de ${threshold}` });
        break;
      }
      case 'legal_exposure': {
        const contestedMet = profile.contested_sanctions >= (c.min_contested_sanctions ?? 1);
        const pendingMet = profile.pending_decisions >= (c.min_pending_decisions ?? 1);
        if (contestedMet) factors.push({ factor: 'contested_sanctions', value: profile.contested_sanctions, threshold: c.min_contested_sanctions ?? 1, description: `${profile.contested_sanctions} sanção(ões) contestada(s)` });
        if (pendingMet) factors.push({ factor: 'pending_decisions', value: profile.pending_decisions, threshold: c.min_pending_decisions ?? 1, description: `${profile.pending_decisions} decisão(ões) pendente(s)` });
        if (!contestedMet && !pendingMet) return null;
        break;
      }
      case 'pattern_detected': {
        const windowDays = c.sliding_window_days ?? 90;
        const minInfractions = c.min_infractions_in_window ?? 3;
        const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
        const recentCount = profile.infraction_dates.filter(d => d >= cutoff).length;
        if (recentCount < minInfractions) return null;
        factors.push({ factor: 'infractions_in_window', value: recentCount, threshold: minInfractions, description: `${recentCount} infrações nos últimos ${windowDays} dias` });
        break;
      }
      default:
        return null;
    }

    const riskScore = this.calculateAlertRiskScore(rule.rule_code, profile, factors);

    return {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      employee_id: employeeId,
      alert_type: rule.rule_code as AlertType,
      severity: this.deriveSeverity(rule.severity, riskScore),
      title: rule.rule_name,
      description: factors.map(f => f.description).join('. ') + '.',
      trigger_factors: factors,
      risk_score: riskScore,
      recommended_actions: this.getRecommendations(rule.rule_code, profile),
      status: 'open',
      created_at: new Date().toISOString(),
    };
  }

  private calculateAlertRiskScore(ruleCode: string, profile: EmployeeProfile, factors: TriggerFactor[]): number {
    let base = 0;
    switch (ruleCode) {
      case 'escalation_risk':
        base = 40 + (profile.warning_count * 10) + (profile.suspension_count * 20);
        break;
      case 'termination_risk':
        base = profile.risk_score;
        break;
      case 'legal_exposure':
        base = 30 + (profile.contested_sanctions * 20) + (profile.pending_decisions * 15);
        break;
      case 'pattern_detected':
        base = 50 + (factors[0] ? Number(factors[0].value) * 10 : 0);
        break;
    }
    return Math.min(100, Math.max(0, base));
  }

  private deriveSeverity(baseSeverity: AlertSeverity, riskScore: number): AlertSeverity {
    if (riskScore >= 90) return 'critical';
    if (riskScore >= 70) return 'high';
    return baseSeverity;
  }

  private getRecommendations(ruleCode: string, profile: EmployeeProfile): string[] {
    switch (ruleCode) {
      case 'escalation_risk':
        return [
          'Agendar reunião com gestor direto para avaliação do caso',
          'Consultar departamento jurídico sobre próximas medidas',
          'Revisar histórico completo do colaborador antes de nova ação',
        ];
      case 'termination_risk':
        return [
          'Encaminhar caso para comitê de avaliação disciplinar',
          'Preparar documentação legal para possível desligamento',
          'Garantir que todas as advertências estejam devidamente assinadas',
          'Verificar cláusulas de estabilidade provisória (CIPA, gestante, etc.)',
        ];
      case 'legal_exposure':
        return [
          'Solicitar parecer do departamento jurídico',
          'Verificar prazo de prescrição das sanções contestadas',
          'Documentar todas as comunicações realizadas',
        ];
      case 'pattern_detected':
        return [
          'Analisar causa raiz da reincidência',
          'Avaliar necessidade de plano de desenvolvimento individual',
          `Considerar transferência de setor se aplicável`,
        ];
      default:
        return ['Avaliar caso individualmente'];
    }
  }

  // ── Persistence ──

  private async persistAlerts(tenantId: string, employeeId: string, alerts: ExecutiveAlert[]): Promise<void> {
    // Deduplicate: skip if same alert_type was created in last 24h for this employee
    const cutoff24h = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from('governance_executive_alerts')
      .select('alert_type')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('status', 'open')
      .gte('created_at', cutoff24h);

    const existingTypes = new Set((existing ?? []).map(e => e.alert_type));
    const newAlerts = alerts.filter(a => !existingTypes.has(a.alert_type));

    if (newAlerts.length === 0) return;

    const { error } = await supabase
      .from('governance_executive_alerts')
      .insert(newAlerts.map(a => ({
        tenant_id: a.tenant_id,
        employee_id: a.employee_id,
        alert_type: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        trigger_factors: a.trigger_factors as unknown as Json,
        risk_score: a.risk_score,
        recommended_actions: a.recommended_actions as unknown as Json,
        status: 'open',
      })));

    if (error) console.error('[AlertEngine] Persist failed:', error.message);
  }

  // ── Employee profile loader ──

  private async loadEmployeeProfile(tenantId: string, employeeId: string): Promise<EmployeeProfile> {
    // Load from sanction projection + org metrics
    const [sanctionProj, timelineProj] = await Promise.all([
      projectionStore.load(tenantId, 'sanction_registry', 'employee', employeeId),
      projectionStore.load(tenantId, 'employee_legal_timeline', 'employee', employeeId),
    ]);

    const sanctions = (sanctionProj?.state ?? {}) as Record<string, unknown>;
    const timeline = (timelineProj?.state ?? {}) as Record<string, unknown>;

    return {
      warning_count: (sanctions.warning_count as number) ?? 0,
      suspension_count: (sanctions.suspension_count as number) ?? 0,
      risk_score: (sanctions.risk_score as number) ?? (timeline.risk_score as number) ?? 0,
      contested_sanctions: (sanctions.contested_count as number) ?? 0,
      pending_decisions: (sanctions.pending_decisions as number) ?? 0,
      infraction_dates: (sanctions.infraction_dates as string[]) ?? (timeline.event_dates as string[]) ?? [],
      total_sanctions: (sanctions.total_sanctions as number) ?? 0,
    };
  }

  // ── Query API ──

  async getOpenAlerts(tenantId: string, opts?: { limit?: number; employeeId?: string }): Promise<ExecutiveAlert[]> {
    let query = supabase
      .from('governance_executive_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (opts?.employeeId) query = query.eq('employee_id', opts.employeeId);

    const { data, error } = await query;
    if (error) throw new Error(`[AlertEngine] Query failed: ${error.message}`);

    return (data ?? []).map(d => ({
      id: d.id,
      tenant_id: d.tenant_id,
      employee_id: d.employee_id,
      alert_type: d.alert_type as AlertType,
      severity: d.severity as AlertSeverity,
      title: d.title,
      description: d.description,
      trigger_factors: d.trigger_factors as unknown as TriggerFactor[],
      risk_score: Number(d.risk_score),
      recommended_actions: d.recommended_actions as unknown as string[],
      status: d.status as AlertStatus,
      created_at: d.created_at,
    }));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('governance_executive_alerts')
      .update({ status: 'acknowledged', acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw new Error(`[AlertEngine] Acknowledge failed: ${error.message}`);
  }

  async resolveAlert(alertId: string, userId: string, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('governance_executive_alerts')
      .update({ status: 'resolved', resolved_by: userId, resolved_at: new Date().toISOString(), resolution_notes: notes ?? null })
      .eq('id', alertId);
    if (error) throw new Error(`[AlertEngine] Resolve failed: ${error.message}`);
  }

  async dismissAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('governance_executive_alerts')
      .update({ status: 'dismissed', resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) throw new Error(`[AlertEngine] Dismiss failed: ${error.message}`);
  }

  async getAlertStats(tenantId: string) {
    const { data } = await supabase
      .from('governance_executive_alerts')
      .select('severity, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'open');

    const alerts = data ?? [];
    return {
      total_open: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
    };
  }
}

// ══════════════════════════════════════════════
// EMPLOYEE PROFILE (internal)
// ══════════════════════════════════════════════

interface EmployeeProfile {
  warning_count: number;
  suspension_count: number;
  risk_score: number;
  contested_sanctions: number;
  pending_decisions: number;
  infraction_dates: string[];
  total_sanctions: number;
}

// ══════════════════════════════════════════════
// EVENT-DRIVEN AUTO-EVALUATION
// ══════════════════════════════════════════════

let _alertEngineInitialized = false;

export function initAlertEngine(): void {
  if (_alertEngineInitialized) return;
  _alertEngineInitialized = true;

  const engine = getAlertEngine();

  const evaluate = (event: GovernanceDomainEvent) => {
    const tenantId = event.metadata.tenant_id;
    const employeeId = (event.payload as Record<string, unknown>).employee_id as string ?? event.aggregate_id;
    if (!tenantId || !employeeId) return;
    // Fire-and-forget evaluation
    engine.evaluateEmployee(tenantId, employeeId).catch(err =>
      console.error('[AlertEngine] Auto-eval failed:', err)
    );
  };

  // React to disciplinary events
  onGovernanceEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeWarned, evaluate);
  onGovernanceEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeSuspended, evaluate);
  onGovernanceEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeTerminated, evaluate);

  // React to sanction events
  onGovernanceEvent(SANCTION_EVENTS.SanctionCreated, evaluate);
  onGovernanceEvent(SANCTION_EVENTS.SanctionEscalated, evaluate);
  onGovernanceEvent(SANCTION_EVENTS.SanctionContested, evaluate);
}

// ── Singleton ──

let _alertEngine: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!_alertEngine) _alertEngine = new AlertEngine();
  initAlertEngine();
  return _alertEngine;
}
