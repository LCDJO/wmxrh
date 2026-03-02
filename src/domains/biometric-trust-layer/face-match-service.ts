/**
 * FaceMatchService — Compares a captured face template against
 * stored enrollment templates to verify identity.
 *
 * Uses hash-based comparison with configurable threshold.
 */

import type { BiometricEnrollment, MatchResult } from './types';
import type { FaceTemplate } from './face-template-generator';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_THRESHOLD = 0.85;

export interface MatchOutcome {
  result: MatchResult;
  score: number;
  enrollment_id?: string;
  processing_time_ms: number;
}

export class FaceMatchService {
  /**
   * Match a captured template against the enrolled template.
   *
   * In production with real ML: compares embedding vectors via cosine similarity.
   * Current implementation: hash comparison + simulated confidence scoring.
   */
  async match(
    capturedTemplate: FaceTemplate,
    enrollment: BiometricEnrollment,
    threshold = DEFAULT_THRESHOLD,
  ): Promise<MatchOutcome> {
    const start = performance.now();

    // Hash-based match (exact match for same-session; real ML uses embeddings)
    const hashMatch = capturedTemplate.hash === enrollment.template_hash;

    // Simulated confidence (real implementation uses vector distance)
    const score = hashMatch ? 0.95 + Math.random() * 0.049 : Math.random() * 0.4;

    const result: MatchResult = score >= threshold ? 'match' : 'no_match';

    return {
      result,
      score: Math.round(score * 10000) / 10000,
      enrollment_id: enrollment.id,
      processing_time_ms: Math.round(performance.now() - start),
    };
  }

  /**
   * Log match result to immutable audit trail.
   */
  async logMatch(
    tenantId: string,
    employeeId: string,
    outcome: MatchOutcome,
    livenessResult: { passed: boolean; score?: number; method: string },
    riskScore: number,
    riskFactors: string[],
    context: {
      worktime_entry_id?: string;
      device_fingerprint?: string;
      ip_address?: string;
      latitude?: number;
      longitude?: number;
      fraud_signals?: string[];
      auto_action?: string;
    },
  ): Promise<string> {
    const { data, error } = await supabase
      .from('biometric_match_logs' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        enrollment_id: outcome.enrollment_id,
        worktime_entry_id: context.worktime_entry_id,
        match_score: outcome.score,
        match_threshold: DEFAULT_THRESHOLD,
        match_result: outcome.result,
        liveness_passed: livenessResult.passed,
        liveness_score: livenessResult.score,
        liveness_method: livenessResult.method,
        risk_score: riskScore,
        risk_factors: riskFactors,
        device_fingerprint: context.device_fingerprint,
        ip_address: context.ip_address,
        latitude: context.latitude,
        longitude: context.longitude,
        processing_time_ms: outcome.processing_time_ms,
        fraud_signals: context.fraud_signals ?? [],
        auto_action: context.auto_action,
      })
      .select('id')
      .single();

    if (error) throw new Error(`[FaceMatchService] Failed to log match: ${error.message}`);
    return (data as any).id;
  }
}
