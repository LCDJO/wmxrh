/**
 * Biometric Trust Layer — Barrel export.
 *
 * Architecture:
 *  BiometricTrustEngine
 *   ├── FaceCaptureController       → image quality validation & normalization
 *   ├── LivenessDetectionService    → passive/active proof-of-life
 *   ├── FaceTemplateGenerator       → SHA-256 irreversible template hashing
 *   ├── BiometricVault              → LGPD-compliant secure storage
 *   ├── FaceMatchService            → template comparison & match logging
 *   ├── BiometricAuditLogger        → immutable audit trail (LGPD Art. 37)
 *   └── RiskScoringEngine           → multi-factor risk assessment
 */

export { BiometricTrustEngine, getBiometricTrustEngine } from './biometric-trust-engine';
export { FaceCaptureController } from './face-capture-controller';
export { LivenessDetectionService } from './liveness-detection-service';
export { FaceTemplateGenerator } from './face-template-generator';
export { BiometricVault } from './biometric-vault';
export { FaceMatchService } from './face-match-service';
export { BiometricAuditLogger } from './biometric-audit-logger';
export { RiskScoringEngine } from './risk-scoring-engine';
export { AntiDeepfakeAnalyzer } from './anti-deepfake-analyzer';
export type { DeepfakeAnalysisResult, DeepfakeSignal } from './anti-deepfake-analyzer';
export { BiometricClockService } from './biometric-clock-service';
export { BiometricFallbackService } from './biometric-fallback-service';
export type { FallbackClockRequest, FallbackClockResult, FallbackReason, FallbackApprovalStatus, FallbackApprovalAction } from './biometric-fallback-service';
export { BiometricLGPDManager, BIOMETRIC_CONSENT_PURPOSES } from './lgpd-compliance-manager';
export type { ConsentPurpose, FallbackMethod, FallbackResult } from './lgpd-compliance-manager';
export type { BiometricClockResult, BiometricClockDecision, BiometricClockInput } from './biometric-clock-service';
export type * from './types';
