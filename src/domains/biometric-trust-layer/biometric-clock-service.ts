/**
 * BiometricClockService — Orchestrates the biometric verification
 * pipeline during clock-in/out events.
 *
 * Flow: capture → quality → liveness → template → match → score → decide
 *
 * Integrates with WorkTimeEngine to reject or flag entries
 * when biometric score falls below threshold.
 */

import { FaceCaptureController } from './face-capture-controller';
import { LivenessDetectionService } from './liveness-detection-service';
import { FaceTemplateGenerator } from './face-template-generator';
import { BiometricVault } from './biometric-vault';
import { FaceMatchService, type MatchOutcome } from './face-match-service';
import { BiometricAuditLogger } from './biometric-audit-logger';
import { RiskScoringEngine } from './risk-scoring-engine';
import {
  incrementBiometricVerifications,
  incrementBiometricSpoofDetections,
  incrementBiometricLivenessFailures,
} from '@/domains/observability/biometric-metrics';
import type { MatchResult, BiometricRiskAssessment } from './types';

// ── Configuration ──────────────────────────────────────────────

const DEFAULT_MATCH_THRESHOLD = 0.85;

// ── Result types ───────────────────────────────────────────────

export type BiometricClockDecision = 'approved' | 'rejected' | 'flagged';

export interface BiometricClockResult {
  decision: BiometricClockDecision;
  match_score: number;
  match_result: MatchResult;
  liveness_passed: boolean;
  liveness_score: number;
  risk_score: number;
  risk_factors: string[];
  match_log_id: string;
  processing_time_ms: number;
  rejection_reason?: string;
}

export interface BiometricClockInput {
  tenant_id: string;
  employee_id: string;
  face_image_data: string; // base64
  worktime_entry_id?: string;
  device_fingerprint?: string;
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  match_threshold?: number;
}

// ── Service ────────────────────────────────────────────────────

export class BiometricClockService {
  private readonly capture = new FaceCaptureController();
  private readonly liveness = new LivenessDetectionService();
  private readonly templateGen = new FaceTemplateGenerator();
  private readonly vault = new BiometricVault();
  private readonly matcher = new FaceMatchService();
  private readonly audit = new BiometricAuditLogger();
  private readonly risk = new RiskScoringEngine();

  /**
   * Execute full biometric verification for a clock event.
   *
   * Steps:
   *  1. Validate capture quality
   *  2. Normalize image
   *  3. Liveness detection
   *  4. Generate temporary template from captured image
   *  5. Retrieve stored enrollment template
   *  6. Compare templates → similarity score
   *  7. Risk assessment
   *  8. Decision: approve / reject / flag
   *  9. Log everything to immutable audit trail
   */
  async verifyForClock(input: BiometricClockInput): Promise<BiometricClockResult> {
    const startTime = performance.now();
    const threshold = input.match_threshold ?? DEFAULT_MATCH_THRESHOLD;

    // ── 1. Validate capture quality ────────────────────────────
    const quality = this.capture.validateCaptureQuality(input.face_image_data);
    if (!quality.acceptable) {
      return this.buildRejection(
        `Qualidade da captura insuficiente: ${quality.issues.join(', ')}`,
        startTime,
      );
    }

    // ── 2. Normalize image ─────────────────────────────────────
    const normalized = this.capture.normalizeImage(input.face_image_data);

    // ── 3. Liveness detection ──────────────────────────────────
    const livenessResult = await this.liveness.evaluate({
      tenant_id: input.tenant_id,
      employee_id: input.employee_id,
      face_image_data: normalized,
    });

    if (!livenessResult.passed) {
      incrementBiometricLivenessFailures({ stage: 'clock_verification' });

      // Log failed liveness to match logs
      const matchLogId = await this.matcher.logMatch(
        input.tenant_id, input.employee_id,
        { result: 'liveness_failed', score: 0, processing_time_ms: livenessResult.processing_time_ms },
        { passed: false, score: livenessResult.confidence_score, method: livenessResult.challenge_type },
        60, ['liveness_failed_at_clock'],
        {
          worktime_entry_id: input.worktime_entry_id,
          device_fingerprint: input.device_fingerprint,
          ip_address: input.ip_address,
          latitude: input.latitude,
          longitude: input.longitude,
          auto_action: 'reject_clock',
        },
      );

      await this.audit.logVerification(input.tenant_id, input.employee_id, matchLogId, 'liveness_failed');

      return {
        decision: 'rejected',
        match_score: 0,
        match_result: 'liveness_failed',
        liveness_passed: false,
        liveness_score: livenessResult.confidence_score,
        risk_score: 60,
        risk_factors: ['liveness_failed_at_clock'],
        match_log_id: matchLogId,
        processing_time_ms: Math.round(performance.now() - startTime),
        rejection_reason: 'Prova de vida falhou — registro rejeitado',
      };
    }

    // ── 4. Generate temporary template from captured image ─────
    const capturedTemplate = await this.templateGen.generate(normalized, input.employee_id);

    // ── 5. Retrieve stored enrollment template ─────────────────
    const enrollment = await this.vault.getActiveEnrollment(input.tenant_id, input.employee_id);
    if (!enrollment) {
      return this.buildRejection(
        'Nenhum enrollment biométrico ativo — realize o cadastro facial primeiro',
        startTime,
      );
    }

    // ── 6. Compare templates → similarity score ────────────────
    const matchOutcome: MatchOutcome = await this.matcher.match(
      capturedTemplate, enrollment, threshold,
    );

    // ── 7. Risk assessment ─────────────────────────────────────
    const riskAssessment: BiometricRiskAssessment = this.risk.assess({
      match_score: matchOutcome.score,
      liveness_score: livenessResult.confidence_score,
      capture_quality: quality.estimated_quality,
    });

    const riskFactors = riskAssessment.factors.map(f => f.factor);

    // ── 8. Decision logic ──────────────────────────────────────
    let decision: BiometricClockDecision;
    let autoAction: string | undefined;
    let rejectionReason: string | undefined;

    if (matchOutcome.score < threshold) {
      // Score below threshold → REJECT + FLAG
      decision = 'rejected';
      autoAction = 'reject_clock';
      rejectionReason = `Score biométrico ${(matchOutcome.score * 100).toFixed(1)}% abaixo do threshold ${(threshold * 100).toFixed(1)}%`;
      incrementBiometricSpoofDetections({ result: matchOutcome.result });
    } else if (riskAssessment.recommended_action === 'flag' || riskAssessment.recommended_action === 'require_liveness') {
      // Score OK but risk elevated → FLAG
      decision = 'flagged';
      autoAction = 'flag_clock';
    } else {
      // Everything OK → APPROVE
      decision = 'approved';
    }

    // ── 9. Log to immutable audit trail ────────────────────────
    const matchLogId = await this.matcher.logMatch(
      input.tenant_id, input.employee_id,
      matchOutcome,
      { passed: true, score: livenessResult.confidence_score, method: livenessResult.challenge_type },
      riskAssessment.overall_score,
      riskFactors,
      {
        worktime_entry_id: input.worktime_entry_id,
        device_fingerprint: input.device_fingerprint,
        ip_address: input.ip_address,
        latitude: input.latitude,
        longitude: input.longitude,
        fraud_signals: decision === 'rejected' ? ['biometric_mismatch'] : riskFactors,
        auto_action: autoAction,
      },
    );

    await this.audit.logVerification(input.tenant_id, input.employee_id, matchLogId, matchOutcome.result);
    incrementBiometricVerifications({ result: matchOutcome.result, decision });

    return {
      decision,
      match_score: matchOutcome.score,
      match_result: matchOutcome.result,
      liveness_passed: true,
      liveness_score: livenessResult.confidence_score,
      risk_score: riskAssessment.overall_score,
      risk_factors: riskFactors,
      match_log_id: matchLogId,
      processing_time_ms: Math.round(performance.now() - startTime),
      rejection_reason: rejectionReason,
    };
  }

  /**
   * Build a quick rejection result for early-exit cases.
   */
  private buildRejection(reason: string, startTime: number): BiometricClockResult {
    return {
      decision: 'rejected',
      match_score: 0,
      match_result: 'error',
      liveness_passed: false,
      liveness_score: 0,
      risk_score: 100,
      risk_factors: ['early_rejection'],
      match_log_id: '',
      processing_time_ms: Math.round(performance.now() - startTime),
      rejection_reason: reason,
    };
  }
}
