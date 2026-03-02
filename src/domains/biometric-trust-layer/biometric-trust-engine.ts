/**
 * BiometricTrustEngine — Unified Facade
 *
 * Orchestrates all biometric sub-services into a single API surface.
 * Integrates with: WorkTimeEngine, ComplianceAutomation, PolicyGovernance,
 *                  AccountEnforcement, Security Kernel, Audit Logger.
 */

import { FaceCaptureController } from './face-capture-controller';
import { LivenessDetectionService } from './liveness-detection-service';
import { FaceTemplateGenerator } from './face-template-generator';
import { BiometricVault } from './biometric-vault';
import { FaceMatchService } from './face-match-service';
import { BiometricAuditLogger } from './biometric-audit-logger';
import { RiskScoringEngine } from './risk-scoring-engine';
import { BiometricLGPDManager, type FallbackResult } from './lgpd-compliance-manager';
import { incrementBiometricEnrollments, incrementBiometricVerifications, incrementBiometricSpoofDetections, incrementBiometricLivenessFailures, incrementBiometricMatchSuccess, incrementLivenessFailures, incrementFraudBiometricFlags } from '@/domains/observability/biometric-metrics';
import { emitBiometricEvent, BIOMETRIC_EVENTS } from './biometric-events';
import type {
  BiometricTrustEngineAPI,
  BiometricEnrollment,
  CreateEnrollmentDTO,
  FaceVerifyDTO,
  FaceVerifyResult,
  LivenessCheckDTO,
  LivenessResult,
  BiometricRiskAssessment,
  BiometricConsent,
  ConsentType,
} from './types';

export class BiometricTrustEngine implements BiometricTrustEngineAPI {
  readonly capture = new FaceCaptureController();
  readonly liveness = new LivenessDetectionService();
  readonly templateGen = new FaceTemplateGenerator();
  readonly vault = new BiometricVault();
  readonly matcher = new FaceMatchService();
  readonly audit = new BiometricAuditLogger();
  readonly risk = new RiskScoringEngine();
  readonly lgpd = new BiometricLGPDManager();

  /**
   * Full enrollment pipeline: capture → quality → liveness → template → store → audit
   */
  async enroll(dto: CreateEnrollmentDTO): Promise<BiometricEnrollment> {
    // 0. LGPD: verify all mandatory consents before enrollment
    const consentCheck = await this.lgpd.verifyMandatoryConsents(dto.tenant_id, dto.employee_id);
    if (!consentCheck.valid) {
      throw new Error(
        `[BiometricTrustEngine] Consentimentos LGPD pendentes: ${consentCheck.missing.join(', ')}. ` +
        `Todos os consentimentos obrigatórios devem ser concedidos antes do enrollment (LGPD Art. 11).`
      );
    }

    // 1. Enforce explicit consent flag + policy version
    if (!dto.consent_granted) {
      throw new Error('[BiometricTrustEngine] Consentimento explícito obrigatório para enrollment biométrico (LGPD Art. 11)');
    }
    if (!dto.consent_version_id) {
      throw new Error('[BiometricTrustEngine] Aceite da política biométrica obrigatório — vincule consent_version_id ao enrollment');
    }

    // 1. Validate capture quality
    const quality = this.capture.validateCaptureQuality(dto.face_image_data);
    if (!quality.acceptable) {
      throw new Error(`[BiometricTrustEngine] Qualidade da captura insuficiente: ${quality.issues.join(', ')}`);
    }

    // 2. Normalize image
    const normalized = this.capture.normalizeImage(dto.face_image_data);

    // 3. Liveness detection
    const livenessResult = await this.liveness.evaluate({
      tenant_id: dto.tenant_id,
      employee_id: dto.employee_id,
      face_image_data: normalized,
    });

    if (!livenessResult.passed) {
      incrementBiometricLivenessFailures({ stage: 'enrollment' });
      incrementLivenessFailures({ stage: 'enrollment', reason: 'liveness_check_failed' });
      emitBiometricEvent({
        type: BIOMETRIC_EVENTS.LivenessCheckFailed,
        payload: {
          tenant_id: dto.tenant_id, employee_id: dto.employee_id, stage: 'enrollment',
          confidence_score: livenessResult.confidence_score, spoof_signals: [],
          deepfake_detected: false, timestamp: new Date().toISOString(),
        },
      });
      throw new Error('[BiometricTrustEngine] Prova de vida falhou — enrollment rejeitado');
    }

    // 4. Generate template hash
    const template = await this.templateGen.generate(normalized, dto.employee_id);

    // 5. Store in vault
    const enrollment = await this.vault.storeEnrollment(dto, template, true);

    // 6. Audit + metrics
    await this.audit.logEnrollment(dto.tenant_id, dto.employee_id, enrollment.id);
    incrementBiometricEnrollments({ method: dto.capture_method });
    emitBiometricEvent({
      type: BIOMETRIC_EVENTS.BiometricEnrollmentCompleted,
      payload: {
        tenant_id: dto.tenant_id, employee_id: dto.employee_id, enrollment_id: enrollment.id,
        capture_method: dto.capture_method, quality_score: 1.0, timestamp: new Date().toISOString(),
      },
    });

    return enrollment;
  }

  /**
   * Full verification pipeline: capture → liveness → template → match → risk → audit
   */
  async verify(dto: FaceVerifyDTO): Promise<FaceVerifyResult> {
    const startTime = performance.now();

    // 1. Get active enrollment
    const enrollment = await this.vault.getActiveEnrollment(dto.tenant_id, dto.employee_id);
    if (!enrollment) {
      throw new Error('[BiometricTrustEngine] Nenhum enrollment ativo encontrado para este colaborador');
    }

    // 2. Normalize image
    const normalized = this.capture.normalizeImage(dto.face_image_data);

    // 3. Liveness check
    const livenessResult = await this.liveness.evaluate({
      tenant_id: dto.tenant_id,
      employee_id: dto.employee_id,
      face_image_data: normalized,
    });

    if (!livenessResult.passed) {
      incrementBiometricLivenessFailures({ stage: 'verification' });

      const matchLogId = await this.matcher.logMatch(
        dto.tenant_id, dto.employee_id,
        { result: 'liveness_failed', score: 0, processing_time_ms: livenessResult.processing_time_ms },
        { passed: false, score: livenessResult.confidence_score, method: livenessResult.challenge_type },
        50, ['liveness_failed'],
        { worktime_entry_id: dto.worktime_entry_id, device_fingerprint: dto.device_fingerprint, ip_address: dto.ip_address, latitude: dto.latitude, longitude: dto.longitude },
      );

      await this.audit.logVerification(dto.tenant_id, dto.employee_id, matchLogId, 'liveness_failed', {
        match_score: 0,
        liveness_score: livenessResult.confidence_score,
        decision: 'rejected',
        device_id: dto.device_fingerprint,
        ip_address: dto.ip_address,
      });

      return {
        match_log_id: matchLogId,
        match_result: 'liveness_failed',
        match_score: 0,
        liveness_passed: false,
        risk_score: 50,
        risk_factors: ['liveness_failed'],
        processing_time_ms: Math.round(performance.now() - startTime),
      };
    }

    // 4. Generate template & match
    const capturedTemplate = await this.templateGen.generate(normalized, dto.employee_id);
    const matchOutcome = await this.matcher.match(capturedTemplate, enrollment);

    // 5. Risk assessment
    const riskAssessment = this.risk.assess({
      match_score: matchOutcome.score,
      liveness_score: livenessResult.confidence_score,
    });

    const riskFactors = riskAssessment.factors.map(f => f.factor);

    // 6. Determine auto-action
    let autoAction: string | undefined;
    if (matchOutcome.result === 'no_match') {
      autoAction = riskAssessment.recommended_action === 'block' ? 'block_entry' : 'flag_entry';
    }

    if (matchOutcome.result === 'match') {
      incrementBiometricMatchSuccess({ tenant_id: dto.tenant_id });
    } else {
      incrementBiometricSpoofDetections({ result: matchOutcome.result });
      incrementFraudBiometricFlags({ fraud_type: matchOutcome.result, severity: riskAssessment.risk_level });
    }

    // 7. Log & audit
    const matchLogId = await this.matcher.logMatch(
      dto.tenant_id, dto.employee_id,
      matchOutcome,
      { passed: true, score: livenessResult.confidence_score, method: livenessResult.challenge_type },
      riskAssessment.overall_score,
      riskFactors,
      {
        worktime_entry_id: dto.worktime_entry_id,
        device_fingerprint: dto.device_fingerprint,
        ip_address: dto.ip_address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        fraud_signals: riskFactors,
        auto_action: autoAction,
      },
    );

    await this.audit.logVerification(dto.tenant_id, dto.employee_id, matchLogId, matchOutcome.result, {
      match_score: matchOutcome.score,
      liveness_score: livenessResult.confidence_score,
      decision: autoAction ?? 'approved',
      device_id: dto.device_fingerprint,
      risk_score: riskAssessment.overall_score,
      risk_level: riskAssessment.risk_level,
      ip_address: dto.ip_address,
    });
    incrementBiometricVerifications({ result: matchOutcome.result });

    if (matchOutcome.result === 'match') {
      emitBiometricEvent({
        type: BIOMETRIC_EVENTS.BiometricMatchSuccess,
        payload: {
          tenant_id: dto.tenant_id, employee_id: dto.employee_id, match_log_id: matchLogId,
          match_score: matchOutcome.score, liveness_score: livenessResult.confidence_score,
          risk_score: riskAssessment.overall_score, device_fingerprint: dto.device_fingerprint,
          ip_address: dto.ip_address, timestamp: new Date().toISOString(),
        },
      });
    } else {
      emitBiometricEvent({
        type: BIOMETRIC_EVENTS.BiometricMatchFailed,
        payload: {
          tenant_id: dto.tenant_id, employee_id: dto.employee_id, match_log_id: matchLogId,
          match_score: matchOutcome.score, match_result: matchOutcome.result,
          liveness_score: livenessResult.confidence_score, risk_score: riskAssessment.overall_score,
          auto_action: autoAction, device_fingerprint: dto.device_fingerprint,
          ip_address: dto.ip_address, timestamp: new Date().toISOString(),
        },
      });
    }

    return {
      match_log_id: matchLogId,
      match_result: matchOutcome.result,
      match_score: matchOutcome.score,
      liveness_passed: true,
      risk_score: riskAssessment.overall_score,
      risk_factors: riskFactors,
      auto_action: autoAction,
      processing_time_ms: Math.round(performance.now() - startTime),
    };
  }

  async checkLiveness(dto: LivenessCheckDTO): Promise<LivenessResult> {
    return this.liveness.evaluate(dto);
  }

  async revokeEnrollment(tenantId: string, enrollmentId: string, reason: string, actorId: string): Promise<void> {
    const enrollment = await this.vault.getActiveEnrollment(tenantId, enrollmentId);
    await this.vault.revokeEnrollment(enrollmentId, reason, actorId);
    await this.audit.logRevocation(tenantId, enrollment?.employee_id ?? '', enrollmentId, reason, actorId);
  }

  async getEnrollment(tenantId: string, employeeId: string): Promise<BiometricEnrollment | null> {
    return this.vault.getActiveEnrollment(tenantId, employeeId);
  }

  async grantConsent(tenantId: string, employeeId: string, consentType: ConsentType, ipAddress: string): Promise<BiometricConsent> {
    const consent = await this.vault.recordConsent(tenantId, employeeId, consentType, true, ipAddress);
    await this.audit.logConsent(tenantId, employeeId, consentType, true);
    return consent;
  }

  async revokeConsent(tenantId: string, employeeId: string, consentType: ConsentType): Promise<void> {
    const result = await this.lgpd.revokeConsent(tenantId, employeeId, consentType, '', 'Revogação pelo titular');
    emitBiometricEvent({
      type: BIOMETRIC_EVENTS.BiometricConsentRevoked,
      payload: {
        tenant_id: tenantId, employee_id: employeeId, consent_type: consentType,
        revoked_at: new Date().toISOString(), lgpd_article: 'Art. 18',
      },
    });
    if (result.fallback) {
      console.info(`[BiometricTrustEngine] Fallback ativado para ${employeeId}: ${result.fallback.method}`);
    }
  }

  /**
   * Delete biometric template (LGPD Art. 18, IV — Right to erasure).
   * Crypto-erases template and activates fallback clock method.
   */
  async deleteTemplate(tenantId: string, employeeId: string, reason: string): Promise<FallbackResult> {
    await this.lgpd.deleteTemplate(tenantId, employeeId, reason);
    return this.lgpd.activateFallback(tenantId, employeeId, 'template_deleted');
  }

  /**
   * Revoke all consents and fully disable biometric for employee.
   */
  async revokeAllConsentsAndDisable(tenantId: string, employeeId: string, ipAddress: string, reason: string): Promise<FallbackResult> {
    return this.lgpd.revokeAllConsents(tenantId, employeeId, ipAddress, reason);
  }

  /**
   * Verify mandatory consents before any biometric operation.
   */
  async verifyConsents(tenantId: string, employeeId: string) {
    return this.lgpd.verifyMandatoryConsents(tenantId, employeeId);
  }

  assessRisk(tenantId: string, employeeId: string, matchScore: number, livenessScore: number, context: Record<string, unknown>): BiometricRiskAssessment {
    return this.risk.assess({
      match_score: matchScore,
      liveness_score: livenessScore,
      ...context as any,
    });
  }
}

// Singleton
let _instance: BiometricTrustEngine | null = null;

export function getBiometricTrustEngine(): BiometricTrustEngine {
  if (!_instance) _instance = new BiometricTrustEngine();
  return _instance;
}
