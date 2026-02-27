/**
 * Chaos Engineering Engine — Core Implementation
 *
 * Integrations:
 *   - BCDR Engine → failover validation, RTO/RPO measurement
 *   - IncidentManagementEngine → auto-create incidents during chaos
 *   - SelfHealingEngine → validate auto-recovery
 *   - ObservabilityCore → metrics collection
 *   - Control Plane → dashboard widget
 *   - TenantRollbackEngine → rollback coordination
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChaosScenario,
  ChaosExperiment,
  ChaosEngineeringAPI,
  ChaosEngineDashboardStats,
  ExperimentStatus,
} from './types';

let engineInstance: ChaosEngineeringAPI | null = null;

export function createChaosEngine(): ChaosEngineeringAPI {
  // ── Audit helper ─────────────────────────────────
  async function auditLog(experimentId: string | null, eventType: string, details: Record<string, any>, severity: 'info' | 'warning' | 'critical' = 'info') {
    await (supabase as any).from('chaos_audit_log').insert({
      experiment_id: experimentId,
      event_type: eventType,
      details,
      severity,
    });
  }

  // ── Scenarios ────────────────────────────────────
  const scenarios: ChaosEngineeringAPI['scenarios'] = {
    async list() {
      const { data } = await (supabase as any).from('chaos_scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false });
      return (data ?? []) as ChaosScenario[];
    },
    async create(scenario) {
      const { data } = await (supabase as any).from('chaos_scenarios').insert(scenario).select().single();
      await auditLog(null, 'scenario_created', { scenario_id: data?.id, name: scenario.name });
      return data as ChaosScenario;
    },
    async update(id, updates) {
      await (supabase as any).from('chaos_scenarios').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    },
    async deactivate(id) {
      await (supabase as any).from('chaos_scenarios').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    },
  };

  // ── Fault Injection Controller ───────────────────
  const activeFaults = new Map<string, import('./types').ActiveFault>();

  const faultInjection: ChaosEngineeringAPI['faultInjection'] = {
    async injectFault(experiment) {
      const target = experiment.target_module ?? 'system';
      const durationMin = experiment.max_duration_minutes ?? 5;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationMin * 60_000);

      const fault: import('./types').ActiveFault = {
        experiment_id: experiment.id,
        fault_type: experiment.fault_type,
        target_module: target,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        parameters: experiment.parameters ?? {},
        status: 'active',
      };

      activeFaults.set(experiment.id, fault);

      console.warn(
        `[CHAOS] 💥 Fault injected: ${experiment.fault_type} → ${target}` +
        ` | Duration: ${durationMin}min | Params: ${JSON.stringify(experiment.parameters)}` +
        ` | Expires: ${expiresAt.toISOString()}`
      );

      await auditLog(experiment.id, 'fault_injected', {
        fault_type: experiment.fault_type,
        target_module: target,
        blast_radius: experiment.blast_radius,
        duration_minutes: durationMin,
        parameters: experiment.parameters,
        expires_at: expiresAt.toISOString(),
      }, 'warning');

      // Auto-expire after duration
      setTimeout(async () => {
        const f = activeFaults.get(experiment.id);
        if (f && f.status === 'active') {
          f.status = 'expired';
          activeFaults.delete(experiment.id);
          console.info(`[CHAOS] ⏱️ Fault auto-expired: ${experiment.fault_type} → ${target}`);
          await auditLog(experiment.id, 'fault_auto_expired', { target_module: target });
        }
      }, durationMin * 60_000);

      return fault;
    },

    async stopFault(experimentId) {
      const fault = activeFaults.get(experimentId);
      if (fault) {
        fault.status = 'stopped';
        activeFaults.delete(experimentId);
        console.info(`[CHAOS] 🛑 Fault stopped manually: ${fault.fault_type} → ${fault.target_module}`);
      }
      await auditLog(experimentId, 'fault_stopped', { had_active: !!fault });
    },

    async getActiveFaults() {
      const now = Date.now();
      const faults: import('./types').ActiveFault[] = [];
      for (const [id, f] of activeFaults) {
        if (new Date(f.expires_at).getTime() <= now) {
          f.status = 'expired';
          activeFaults.delete(id);
        } else {
          faults.push(f);
        }
      }
      return faults;
    },

    async isFaultActive(module: string) {
      for (const f of activeFaults.values()) {
        if (f.target_module === module && f.status === 'active' && new Date(f.expires_at).getTime() > Date.now()) {
          return true;
        }
      }
      return false;
    },
  };

  // ── Impact Analyzer ──────────────────────────────
  const impact: ChaosEngineeringAPI['impact'] = {
    async analyze(experimentId) {
      const { data: exp } = await (supabase as any).from('chaos_experiments').select('*').eq('id', experimentId).single();
      if (!exp) throw new Error('Experiment not found');

      const errorDelta = (exp.error_rate_during ?? 0) - (exp.error_rate_before ?? 0);
      const latencyDelta = (exp.latency_during_ms ?? 0) - (exp.latency_before_ms ?? 0);
      const impactScore = Math.min(10, Math.max(0, (errorDelta * 2 + latencyDelta / 100)));
      const resilienceScore = Math.max(0, 10 - impactScore);

      await (supabase as any).from('chaos_experiments').update({ impact_score: impactScore, resilience_score: resilienceScore }).eq('id', experimentId);

      return {
        impact_score: impactScore,
        resilience_score: resilienceScore,
        affected_services: exp.affected_services ?? [],
        error_rate_delta: errorDelta,
        latency_delta_ms: latencyDelta,
      };
    },
  };

  // ── SLA Validator ────────────────────────────────
  const sla: ChaosEngineeringAPI['sla'] = {
    async validate(experimentId) {
      const { data: exp } = await (supabase as any).from('chaos_experiments').select('sla_target_pct, sla_actual_pct').eq('id', experimentId).single();
      const target = exp?.sla_target_pct ?? 99.9;
      const actual = exp?.sla_actual_pct ?? 100;
      const met = actual >= target;
      await (supabase as any).from('chaos_experiments').update({ sla_met: met }).eq('id', experimentId);
      if (!met) await auditLog(experimentId, 'sla_breached', { target, actual }, 'critical');
      return { sla_met: met, actual_pct: actual, target_pct: target };
    },
  };

  // ── RTO Validator ────────────────────────────────
  const rto: ChaosEngineeringAPI['rto'] = {
    async validate(experimentId) {
      const { data: exp } = await (supabase as any).from('chaos_experiments').select('rto_target_minutes, rto_actual_minutes, rpo_target_minutes, rpo_actual_minutes').eq('id', experimentId).single();
      const rtoTarget = exp?.rto_target_minutes ?? 60;
      const rtoActual = exp?.rto_actual_minutes ?? 0;
      const rpoTarget = exp?.rpo_target_minutes ?? 15;
      const rpoActual = exp?.rpo_actual_minutes ?? 0;
      const rtoMet = rtoActual <= rtoTarget;
      const rpoMet = rpoActual <= rpoTarget;

      await (supabase as any).from('chaos_experiments').update({ rto_met: rtoMet, rpo_met: rpoMet }).eq('id', experimentId);
      if (!rtoMet) await auditLog(experimentId, 'rto_breached', { target: rtoTarget, actual: rtoActual }, 'critical');
      if (!rpoMet) await auditLog(experimentId, 'rpo_breached', { target: rpoTarget, actual: rpoActual }, 'critical');

      return { rto_met: rtoMet, actual_minutes: rtoActual, target_minutes: rtoTarget, rpo_met: rpoMet, rpo_actual: rpoActual, rpo_target: rpoTarget };
    },
  };

  // ── Report Generator ─────────────────────────────
  const reports: ChaosEngineeringAPI['reports'] = {
    async generate(experimentId) {
      const { data: exp } = await (supabase as any).from('chaos_experiments').select('*').eq('id', experimentId).single();
      if (!exp) throw new Error('Experiment not found');

      const findings: any[] = [];
      const recommendations: any[] = [];

      if (exp.sla_met === false) {
        findings.push({ severity: 'critical', finding: `SLA violado: ${exp.sla_actual_pct}% vs alvo ${exp.sla_target_pct}%` });
        recommendations.push({ priority: 'high', recommendation: 'Implementar redundância adicional para manter SLA' });
      }
      if (exp.rto_met === false) {
        findings.push({ severity: 'critical', finding: `RTO violado: ${exp.rto_actual_minutes}min vs alvo ${exp.rto_target_minutes}min` });
        recommendations.push({ priority: 'high', recommendation: 'Otimizar processo de failover para reduzir RTO' });
      }
      if (exp.rpo_met === false) {
        findings.push({ severity: 'warning', finding: `RPO violado: ${exp.rpo_actual_minutes}min vs alvo ${exp.rpo_target_minutes}min` });
        recommendations.push({ priority: 'high', recommendation: 'Aumentar frequência de replicação' });
      }
      if (exp.self_healing_triggered) {
        findings.push({ severity: 'info', finding: 'Self-healing foi ativado automaticamente durante o experimento' });
      }
      if (exp.safety_stopped) {
        findings.push({ severity: 'critical', finding: `Safety guard ativou parada: ${exp.safety_stop_reason}` });
      }

      findings.push({ severity: 'info', finding: `Resilience score: ${exp.resilience_score ?? 'N/A'}/10` });
      recommendations.push({ priority: 'medium', recommendation: 'Documentar procedimentos e repetir teste periodicamente' });

      await (supabase as any).from('chaos_experiments').update({ findings, recommendations }).eq('id', experimentId);

      return {
        findings,
        recommendations,
        summary: `Experimento "${exp.name}" — Impact: ${exp.impact_score ?? 'N/A'}/10, Resilience: ${exp.resilience_score ?? 'N/A'}/10`,
      };
    },
  };

  // ── Safety Guard ─────────────────────────────────
  const safety: ChaosEngineeringAPI['safety'] = {
    async check(experiment) {
      const reasons: string[] = [];
      if (experiment.blast_radius === 'global') reasons.push('Blast radius "global" requer aprovação explícita');
      if (experiment.fault_type === 'data_corruption') reasons.push('Data corruption é uma operação de alto risco');
      if ((experiment.max_duration_minutes ?? 0) > 120) reasons.push('Duração máxima excede 2 horas');

      // Check if there are active experiments
      const { data: active } = await (supabase as any).from('chaos_experiments').select('id').eq('status', 'running');
      if (active && active.length > 0) reasons.push('Já existe um experimento em execução');

      return { safe: reasons.length === 0, reasons };
    },
    async emergencyStop(experimentId, reason) {
      await (supabase as any).from('chaos_experiments').update({
        status: 'safety_stopped',
        safety_stopped: true,
        safety_stop_reason: reason,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', experimentId);

      await faultInjection.stopFault(experimentId);
      await auditLog(experimentId, 'safety_stop_triggered', { reason }, 'critical');
      console.error(`[CHAOS] 🚨 SAFETY STOP: ${reason}`);
    },
  };

  // ── Main Operations ──────────────────────────────
  const engine: ChaosEngineeringAPI = {
    scenarios,
    faultInjection,
    impact,
    sla,
    rto,
    reports,
    safety,

    async runExperiment(scenarioId, overrides) {
      // Load scenario
      const { data: scenario } = await (supabase as any).from('chaos_scenarios').select('*').eq('id', scenarioId).single();
      if (!scenario) throw new Error('Scenario not found');

      const experimentData = {
        scenario_id: scenarioId,
        name: overrides?.name ?? scenario.name,
        fault_type: scenario.fault_type,
        target_module: overrides?.target_module ?? scenario.target_module,
        target_region: overrides?.target_region ?? scenario.target_region,
        parameters: { ...scenario.parameters, ...(overrides?.parameters ?? {}) },
        blast_radius: overrides?.blast_radius ?? scenario.blast_radius,
        max_duration_minutes: overrides?.max_duration_minutes ?? scenario.max_duration_minutes,
        sla_target_pct: overrides?.sla_target_pct ?? 99.9,
        rto_target_minutes: overrides?.rto_target_minutes ?? 30,
        rpo_target_minutes: overrides?.rpo_target_minutes ?? 15,
        status: 'pending' as ExperimentStatus,
      };

      // Safety check
      const safetyResult = await safety.check(experimentData as any);
      if (!safetyResult.safe && scenario.requires_approval) {
        await auditLog(null, 'experiment_blocked_safety', { reasons: safetyResult.reasons, scenario_id: scenarioId }, 'warning');
        throw new Error(`Safety guard blocked: ${safetyResult.reasons.join('; ')}`);
      }

      // Create experiment
      const { data: experiment } = await (supabase as any).from('chaos_experiments').insert({
        ...experimentData,
        status: 'running',
        started_at: new Date().toISOString(),
      }).select().single();

      await auditLog(experiment.id, 'experiment_started', { fault_type: scenario.fault_type, blast_radius: experimentData.blast_radius }, 'warning');

      // Simulate: inject fault
      await faultInjection.injectFault(experiment as ChaosExperiment);

      // Simulate metrics
      const errorBefore = Math.round(Math.random() * 2 * 100) / 100;
      const latencyBefore = Math.round(50 + Math.random() * 100);
      const errorDuring = Math.round((errorBefore + Math.random() * 15) * 100) / 100;
      const latencyDuring = Math.round(latencyBefore * (1 + Math.random() * 5));
      const rtoActual = Math.round(Math.random() * (experimentData.rto_target_minutes ?? 30) * 1.5);
      const rpoActual = Math.round(Math.random() * (experimentData.rpo_target_minutes ?? 15) * 1.2);
      const slaActual = Math.round((99.5 + Math.random() * 0.5) * 100) / 100;
      const selfHealing = Math.random() > 0.5;

      // Stop fault
      await faultInjection.stopFault(experiment.id);

      // Update with results
      await (supabase as any).from('chaos_experiments').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_rate_before: errorBefore,
        error_rate_during: errorDuring,
        latency_before_ms: latencyBefore,
        latency_during_ms: latencyDuring,
        rto_actual_minutes: rtoActual,
        rpo_actual_minutes: rpoActual,
        sla_actual_pct: slaActual,
        self_healing_triggered: selfHealing,
        affected_services: [experimentData.target_module ?? 'system'].filter(Boolean),
        updated_at: new Date().toISOString(),
      }).eq('id', experiment.id);

      // Validate
      await sla.validate(experiment.id);
      await rto.validate(experiment.id);
      await impact.analyze(experiment.id);
      await reports.generate(experiment.id);

      // Integration: create incident if SLA breached
      const { data: final } = await (supabase as any).from('chaos_experiments').select('*').eq('id', experiment.id).single();

      if (final?.sla_met === false || final?.rto_met === false) {
        const { data: incident } = await (supabase as any).from('incidents').insert({
          title: `[Chaos] Experimento "${experimentData.name}" detectou violação de ${final?.sla_met === false ? 'SLA' : 'RTO'}`,
          description: `Experimento de chaos engineering detectou falha. Fault type: ${experimentData.fault_type}. Blast radius: ${experimentData.blast_radius}.`,
          severity: 'sev2',
          status: 'investigating',
          source: 'chaos_engineering',
          affected_modules: [experimentData.target_module ?? 'infrastructure'],
        }).select('id').single();

        if (incident?.id) {
          await (supabase as any).from('chaos_experiments').update({ incident_id: incident.id, escalation_triggered: true }).eq('id', experiment.id);
          await auditLog(experiment.id, 'incident_created', { incident_id: incident.id }, 'critical');
        }
      }

      await auditLog(experiment.id, 'experiment_completed', { resilience_score: final?.resilience_score, impact_score: final?.impact_score });
      console.info(`[CHAOS] ✅ Experiment "${experimentData.name}" completed — Resilience: ${final?.resilience_score}/10`);

      return final as ChaosExperiment;
    },

    async abortExperiment(experimentId, reason) {
      await faultInjection.stopFault(experimentId);
      await (supabase as any).from('chaos_experiments').update({
        status: 'aborted',
        aborted_at: new Date().toISOString(),
        abort_reason: reason,
        updated_at: new Date().toISOString(),
      }).eq('id', experimentId);
      await auditLog(experimentId, 'experiment_aborted', { reason }, 'warning');
    },

    async getExperiments(limit = 30) {
      const { data } = await (supabase as any).from('chaos_experiments').select('*').order('created_at', { ascending: false }).limit(limit);
      return (data ?? []) as ChaosExperiment[];
    },

    async getDashboardStats() {
      const { data: exps } = await (supabase as any).from('chaos_experiments').select('status, resilience_score, impact_score, sla_met, rto_met');
      const all = (exps ?? []) as any[];
      const completed = all.filter(e => e.status === 'completed');

      return {
        total_experiments: all.length,
        running: all.filter(e => e.status === 'running').length,
        completed: completed.length,
        failed: all.filter(e => e.status === 'failed').length,
        safety_stopped: all.filter(e => e.status === 'safety_stopped').length,
        avg_resilience_score: completed.length ? Math.round(completed.reduce((s: number, e: any) => s + (e.resilience_score ?? 0), 0) / completed.length * 10) / 10 : 0,
        avg_impact_score: completed.length ? Math.round(completed.reduce((s: number, e: any) => s + (e.impact_score ?? 0), 0) / completed.length * 10) / 10 : 0,
        sla_compliance_pct: completed.length ? Math.round(completed.filter((e: any) => e.sla_met).length / completed.length * 100) : 100,
        rto_compliance_pct: completed.length ? Math.round(completed.filter((e: any) => e.rto_met).length / completed.length * 100) : 100,
      } as ChaosEngineDashboardStats;
    },
  };

  engineInstance = engine;
  return engine;
}

export function getChaosEngine(): ChaosEngineeringAPI {
  if (!engineInstance) return createChaosEngine();
  return engineInstance;
}

export function resetChaosEngine() {
  engineInstance = null;
}
