/**
 * DriverRiskScoreEngine — Computes a weighted 0–100 score per driver.
 *
 * Weights:
 *  - Speed compliance: 40%
 *  - Braking smoothness: 20%
 *  - Idle discipline: 10%
 *  - Compliance (warnings + agreements): 30%
 *
 * Pure function — no I/O.
 */

import type { BehaviorEvent, DriverRiskScore } from './types';

export interface ScoreInput {
  employeeId: string;
  employeeName?: string;
  behaviorEvents: BehaviorEvent[];
  activeWarnings: number;
  pendingAgreements: number;
  daysSinceLastIncident: number;
  totalTrips: number;
  totalDistanceKm: number;
  periodStart: string;
  periodEnd: string;
}

const RECENCY_DECAY_DAYS = 90;

export function computeDriverRiskScore(input: ScoreInput): DriverRiskScore {
  const {
    employeeId, employeeName, behaviorEvents, activeWarnings,
    pendingAgreements, daysSinceLastIncident, totalTrips, totalDistanceKm,
    periodStart, periodEnd,
  } = input;

  const now = new Date(periodEnd);
  const factors: string[] = [];

  // ── Count events by type with recency decay ──
  let overspeedPenalty = 0;
  let brakePenalty = 0;
  let idlePenalty = 0;
  let totalViolations = 0;

  for (const evt of behaviorEvents) {
    const daysAgo = Math.max(0, (now.getTime() - new Date(evt.event_timestamp).getTime()) / 86_400_000);
    const decay = Math.max(0, 1 - daysAgo / RECENCY_DECAY_DAYS);
    const sevWeight = evt.severity === 'critical' ? 15 : evt.severity === 'high' ? 8 : evt.severity === 'medium' ? 4 : 2;
    const w = sevWeight * decay;

    if (evt.event_type === 'overspeed' || evt.event_type === 'radar_violation') {
      overspeedPenalty += w;
      totalViolations++;
    } else if (evt.event_type === 'harsh_brake' || evt.event_type === 'harsh_accel') {
      brakePenalty += w;
    } else if (evt.event_type === 'excessive_idle') {
      idlePenalty += w;
    } else {
      overspeedPenalty += w * 0.5; // other events partially affect speed score
      totalViolations++;
    }
  }

  // ── Sub-scores (0–100) ──
  const speedScore = Math.max(0, Math.min(100, 100 - overspeedPenalty));
  const brakingScore = Math.max(0, Math.min(100, 100 - brakePenalty));
  const idleScore = Math.max(0, Math.min(100, 100 - idlePenalty));

  // Compliance score
  const warningPenalty = activeWarnings * 15;
  const agreementPenalty = pendingAgreements * 10;
  const recencyBonus = daysSinceLastIncident >= 30
    ? Math.min(10, Math.floor(daysSinceLastIncident / 30) * 2)
    : 0;
  const complianceScore = Math.max(0, Math.min(100, 100 - warningPenalty - agreementPenalty + recencyBonus));

  // ── Weighted overall ──
  const overall = Math.round(
    speedScore * 0.4 +
    brakingScore * 0.2 +
    idleScore * 0.1 +
    complianceScore * 0.3
  );

  const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 40 ? 'D' : 'E';
  const riskLevel = overall >= 80 ? 'low' : overall >= 60 ? 'medium' : overall >= 40 ? 'high' : 'critical';

  // ── Factors ──
  if (overspeedPenalty > 30) factors.push('Infrações de velocidade frequentes');
  if (brakePenalty > 20) factors.push('Frenagens/acelerações bruscas');
  if (idlePenalty > 15) factors.push('Tempo ocioso excessivo');
  if (activeWarnings > 0) factors.push(`${activeWarnings} advertência(s) ativa(s)`);
  if (pendingAgreements > 0) factors.push('Termos pendentes de assinatura');
  if (recencyBonus >= 6) factors.push('Período prolongado sem incidentes');
  if (factors.length === 0) factors.push('Perfil de condução adequado');

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    overall_score: overall,
    grade,
    speed_score: Math.round(speedScore),
    braking_score: Math.round(brakingScore),
    compliance_score: Math.round(complianceScore),
    idle_score: Math.round(idleScore),
    total_trips: totalTrips,
    total_distance_km: Math.round(totalDistanceKm),
    total_violations: totalViolations,
    risk_level: riskLevel,
    factors,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

/**
 * Batch compute and rank drivers by score (worst first).
 */
export function computeBatchDriverScores(inputs: ScoreInput[]): DriverRiskScore[] {
  return inputs
    .map(computeDriverRiskScore)
    .sort((a, b) => a.overall_score - b.overall_score);
}
