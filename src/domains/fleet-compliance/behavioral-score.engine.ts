/**
 * Behavioral Score Engine
 *
 * Computes a 0–100 driver safety score per employee based on:
 *  - Driving behavior events (weighted by severity & recency)
 *  - Warning history (escalation penalty)
 *  - Positive factors (days without incidents, signed agreements)
 *
 * Pure function — no I/O.
 */

import type {
  FleetBehaviorEvent,
  FleetWarning,
  BehaviorSeverity,
} from './types';

// ── Config ──

const SEVERITY_PENALTY: Record<BehaviorSeverity, number> = {
  low: 2,
  medium: 5,
  high: 12,
  critical: 25,
};

const WARNING_PENALTY: Record<string, number> = {
  verbal: 5,
  written: 10,
  suspension: 25,
  termination: 50,
};

const RECENCY_DECAY_DAYS = 90;
const BASE_SCORE = 100;

// ── Types ──

export interface BehavioralScoreInput {
  employeeId: string;
  behaviorEvents: FleetBehaviorEvent[];
  warnings: FleetWarning[];
  /** Days since last incident (0 = incident today) */
  daysSinceLastIncident: number;
  /** Whether all mandatory agreements are signed */
  allAgreementsSigned: boolean;
  /** Reference date for recency calculation */
  referenceDate?: Date;
}

export interface BehavioralScoreResult {
  employeeId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalPenalty: number;
  totalBonus: number;
  breakdown: {
    behaviorPenalty: number;
    warningPenalty: number;
    recencyBonus: number;
    agreementBonus: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Top contributing factors */
  factors: string[];
}

// ── Engine ──

export function computeBehavioralScore(input: BehavioralScoreInput): BehavioralScoreResult {
  const { employeeId, behaviorEvents, warnings, daysSinceLastIncident, allAgreementsSigned } = input;
  const refDate = input.referenceDate || new Date();
  const factors: string[] = [];

  // ── Behavior penalty (with recency decay) ──
  let behaviorPenalty = 0;
  for (const evt of behaviorEvents) {
    const daysAgo = daysBetween(new Date(evt.event_timestamp), refDate);
    const decay = Math.max(0, 1 - daysAgo / RECENCY_DECAY_DAYS);
    behaviorPenalty += SEVERITY_PENALTY[evt.severity] * decay;
  }
  behaviorPenalty = Math.round(behaviorPenalty * 10) / 10;

  if (behaviorPenalty > 30) factors.push('Infrações frequentes/graves');
  else if (behaviorPenalty > 15) factors.push('Infrações moderadas');

  // ── Warning penalty ──
  let warningPenalty = 0;
  for (const w of warnings) {
    warningPenalty += WARNING_PENALTY[w.warning_type] || 5;
  }

  if (warningPenalty > 20) factors.push('Histórico de advertências');

  // ── Bonuses ──
  const recencyBonus = daysSinceLastIncident >= 30
    ? Math.min(15, Math.floor(daysSinceLastIncident / 30) * 3)
    : 0;

  if (recencyBonus >= 9) factors.push('Período prolongado sem incidentes');

  const agreementBonus = allAgreementsSigned ? 5 : 0;
  if (!allAgreementsSigned) factors.push('Termos obrigatórios pendentes');

  // ── Final score ──
  const totalPenalty = behaviorPenalty + warningPenalty;
  const totalBonus = recencyBonus + agreementBonus;
  const raw = BASE_SCORE - totalPenalty + totalBonus;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const riskLevel = score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical';

  if (factors.length === 0) factors.push('Perfil de condução adequado');

  return {
    employeeId,
    score,
    grade,
    totalPenalty,
    totalBonus,
    breakdown: { behaviorPenalty, warningPenalty, recencyBonus, agreementBonus },
    riskLevel,
    factors,
  };
}

/**
 * Batch compute scores for multiple employees.
 */
export function computeBatchScores(
  inputs: BehavioralScoreInput[],
): BehavioralScoreResult[] {
  return inputs
    .map(computeBehavioralScore)
    .sort((a, b) => a.score - b.score); // worst first
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}
