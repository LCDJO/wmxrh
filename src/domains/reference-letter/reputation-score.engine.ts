/**
 * ReputationScoreEngine
 *
 * Computes a 0–100 reputation score for reference letter eligibility.
 *
 * Factors (weighted):
 *   - Fleet warnings count            (weight: 25)
 *   - Fleet disciplinary events       (weight: 20)
 *   - Behavioral score (fleet)        (weight: 20)
 *   - Archived disciplinary snapshot   (weight: 20)
 *   - Tenure bonus                    (weight: 15)
 *
 * Output:
 *   - score: 0–100
 *   - eligible: boolean (score >= threshold)
 *   - justification: human-readable string
 *   - factors: breakdown per category
 */

import { supabase } from '@/integrations/supabase/client';
import { differenceInMonths, parseISO, subDays } from 'date-fns';

// ── Types ──

export interface ReputationFactor {
  category: string;
  label: string;
  raw_value: number;
  penalty: number;       // 0–100 how much it deducts
  weight: number;        // 0–1
}

export interface ReputationScoreResult {
  employee_id: string;
  score: number;          // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  eligible: boolean;
  justification: string;
  suggested_text: string | null;
  factors: ReputationFactor[];
}

export interface ReputationScoreConfig {
  threshold: number;               // default 60
  warning_penalty_each: number;    // default 8
  disciplinary_penalty_each: number; // default 12
  lookback_days: number;           // default 365
}

const DEFAULT_CONFIG: ReputationScoreConfig = {
  threshold: 60,
  warning_penalty_each: 8,
  disciplinary_penalty_each: 12,
  lookback_days: 365,
};

const POSITIVE_TEXT = 'Nada consta que desabone sua conduta profissional enquanto atuou na empresa.';

// ── Grade mapping ──

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

// ── Main Engine ──

export async function computeReputationScore(
  tenantId: string,
  employeeId: string,
  config: Partial<ReputationScoreConfig> = {},
): Promise<ReputationScoreResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cutoffDate = subDays(new Date(), cfg.lookback_days).toISOString();
  const factors: ReputationFactor[] = [];
  let totalWeightedPenalty = 0;

  // ── Factor 1: Fleet Warnings (weight 0.25) ──
  const { count: warningCount } = await supabase
    .from('fleet_warnings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('issued_at', cutoffDate);

  const warnCount = warningCount || 0;
  const warningPenalty = Math.min(100, warnCount * cfg.warning_penalty_each);
  factors.push({
    category: 'fleet_warnings',
    label: 'Advertências de Frota',
    raw_value: warnCount,
    penalty: warningPenalty,
    weight: 0.25,
  });
  totalWeightedPenalty += warningPenalty * 0.25;

  // ── Factor 2: Fleet Disciplinary Events (weight 0.20) ──
  const { count: discCount } = await supabase
    .from('fleet_disciplinary_history')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('created_at', cutoffDate);

  const discEvents = discCount || 0;
  const discPenalty = Math.min(100, discEvents * cfg.disciplinary_penalty_each);
  factors.push({
    category: 'fleet_disciplinary',
    label: 'Eventos Disciplinares (Frota)',
    raw_value: discEvents,
    penalty: discPenalty,
    weight: 0.20,
  });
  totalWeightedPenalty += discPenalty * 0.20;

  // ── Factor 3: Behavioral Score from fleet (weight 0.20) ──
  // Try to get the latest behavioral score from fleet_behavior_events
  const { data: behaviorEvents } = await supabase
    .from('fleet_behavior_events')
    .select('severity')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('created_at', cutoffDate);

  let behaviorPenalty = 0;
  const severityWeights: Record<string, number> = { low: 1, medium: 3, high: 7, critical: 15 };
  if (behaviorEvents && behaviorEvents.length > 0) {
    const totalSeverityPoints = behaviorEvents.reduce((sum, e) => {
      return sum + (severityWeights[(e.severity || 'low').toLowerCase()] || 1);
    }, 0);
    // Normalize: 50+ severity points = 100% penalty
    behaviorPenalty = Math.min(100, Math.round((totalSeverityPoints / 50) * 100));
  }
  factors.push({
    category: 'behavioral_score',
    label: 'Comportamento de Direção',
    raw_value: behaviorEvents?.length || 0,
    penalty: behaviorPenalty,
    weight: 0.20,
  });
  totalWeightedPenalty += behaviorPenalty * 0.20;

  // ── Factor 4: Archived disciplinary snapshot (weight 0.20) ──
  const { data: archive } = await supabase
    .from('archived_employee_profiles')
    .select('disciplinary_snapshot')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  let archiveDisciplinaryCount = 0;
  if (archive?.disciplinary_snapshot) {
    const snap = archive.disciplinary_snapshot as any;
    archiveDisciplinaryCount = Array.isArray(snap) ? snap.length : 0;
  }
  const archivePenalty = Math.min(100, archiveDisciplinaryCount * 10);
  factors.push({
    category: 'disciplinary_history',
    label: 'Histórico Disciplinar Geral',
    raw_value: archiveDisciplinaryCount,
    penalty: archivePenalty,
    weight: 0.20,
  });
  totalWeightedPenalty += archivePenalty * 0.20;

  // ── Factor 5: Tenure bonus (weight 0.15) — inverse: longer tenure = less penalty ──
  const { data: employee } = await supabase
    .from('employees')
    .select('hire_date')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let tenureMonths = 0;
  if (employee?.hire_date) {
    tenureMonths = differenceInMonths(new Date(), parseISO(employee.hire_date));
  } else if (archive) {
    const empSnap = (archive as any).employee_snapshot as any;
    const admDate = empSnap?.record?.data_admissao;
    if (admDate) tenureMonths = differenceInMonths(new Date(), parseISO(admDate));
  }
  // Tenure bonus: 0 months = 100 penalty, 60+ months = 0 penalty
  const tenurePenalty = Math.max(0, Math.round(100 - (tenureMonths / 60) * 100));
  factors.push({
    category: 'tenure',
    label: 'Tempo de Empresa',
    raw_value: tenureMonths,
    penalty: tenurePenalty,
    weight: 0.15,
  });
  totalWeightedPenalty += tenurePenalty * 0.15;

  // ── Final Score ──
  const score = Math.max(0, Math.min(100, Math.round(100 - totalWeightedPenalty)));
  const grade = scoreToGrade(score);
  const eligible = score >= cfg.threshold;

  // ── Justification ──
  const negativeFactors = factors
    .filter(f => f.penalty > 20)
    .sort((a, b) => b.penalty * b.weight - a.penalty * a.weight);

  let justification: string;
  if (eligible) {
    justification = `Score ${score}/100 (${grade}). Elegível para carta de referência.`;
    if (negativeFactors.length > 0) {
      justification += ` Atenção: ${negativeFactors.map(f => f.label.toLowerCase()).join(', ')}.`;
    }
  } else {
    const mainReasons = negativeFactors.slice(0, 3).map(f => `${f.label} (${f.raw_value})`).join('; ');
    justification = `Score ${score}/100 (${grade}) — abaixo do limite ${cfg.threshold}. Motivos: ${mainReasons || 'múltiplos fatores'}.`;
  }

  return {
    employee_id: employeeId,
    score,
    grade,
    eligible,
    justification,
    suggested_text: eligible ? POSITIVE_TEXT : null,
    factors,
  };
}
