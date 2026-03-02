/**
 * BehavioralAIEngine — Unified Facade
 *
 * Orchestrates: BehaviorCaptureSDK → FeatureExtraction → ProfileManager →
 *               AnomalyDetection → RiskScoring → FraudPatternDB → AdaptiveLearning
 *
 * Integrates with:
 *   - WorkTimeEngine       (clock event enrichment)
 *   - BiometricTrustLayer  (combined risk scoring)
 *   - GeoFenceValidator    (location fraud)
 *   - DeviceIntegrityValidator (device signals)
 *   - AccountEnforcementEngine (escalation → ban)
 *   - ObservabilityCore    (metrics export)
 */

import { BehaviorCaptureSDK } from './behavior-capture-sdk';
import { FeatureExtractionService } from './feature-extraction-service';
import { BehaviorProfileManager } from './behavior-profile-manager';
import { AnomalyDetectionModel } from './anomaly-detection-model';
import { BehavioralRiskScoringEngine } from './behavioral-risk-scoring-engine';
import { UnifiedRiskScoringEngine } from './unified-risk-scoring-engine';
import { FraudPatternDatabase } from './fraud-pattern-database';
import { AdaptiveLearningModule } from './adaptive-learning-module';
import { incrementFraudFlags } from '@/domains/observability/worktime-metrics';
import { purgeRawSamples, sanitizeFeatureVector, anonymizeSession } from './behavior-data-sanitizer';

import type {
  BehavioralAIEngineAPI, BehaviorCaptureSession, BehavioralFeatureVector,
  AnomalyDetection, BehavioralRiskAssessment, FraudIncident, LearningFeedback,
  BehaviorProfile, UnifiedRiskInput, UnifiedRiskAssessment, ProfileSimilarityMatch,
} from './types';

export class BehavioralAIEngine implements BehavioralAIEngineAPI {
  readonly capture = new BehaviorCaptureSDK();
  readonly featureExtractor = new FeatureExtractionService();
  readonly profileManager = new BehaviorProfileManager();
  readonly anomalyModel: AnomalyDetectionModel;
  readonly riskScoring = new BehavioralRiskScoringEngine();
  readonly unifiedRisk = new UnifiedRiskScoringEngine();
  readonly fraudDB = new FraudPatternDatabase();
  readonly adaptiveLearning: AdaptiveLearningModule;

  /** Recent feature vectors per employee for replay detection */
  private recentFeatures = new Map<string, BehavioralFeatureVector[]>();
  private static readonly MAX_RECENT = 5;

  constructor() {
    this.anomalyModel = new AnomalyDetectionModel(this.profileManager);
    this.adaptiveLearning = new AdaptiveLearningModule(this.fraudDB, this.profileManager);
  }

  // ── Pipeline step 1: Capture ─────────────────────────────────

  async captureBehavior(session: BehaviorCaptureSession): Promise<string> {
    // ── SECURITY: Anonymize device fingerprint (one-way hash) ──
    const anonSession = await anonymizeSession(session);

    // Extract statistical features from raw samples
    const rawFeatures = this.featureExtractor.extract(anonSession);

    // ── SECURITY: Sanitize — strip any accidental raw/PII fields ──
    const features = sanitizeFeatureVector(rawFeatures);

    // ── SECURITY: Purge raw samples — only vectors survive ──
    purgeRawSamples(anonSession);

    // Update profile with anonymized vector only
    this.profileManager.updateProfile(anonSession.tenant_id, anonSession.employee_id, features);

    // Store in recent for replay detection (vectors only, no raw data)
    const key = `${anonSession.tenant_id}::${anonSession.employee_id}`;
    const recent = this.recentFeatures.get(key) ?? [];
    recent.push(features);
    if (recent.length > BehavioralAIEngine.MAX_RECENT) recent.shift();
    this.recentFeatures.set(key, recent);

    return features.session_id;
  }

  // ── Pipeline step 2: Extract features ────────────────────────

  async extractFeatures(sessionId: string): Promise<BehavioralFeatureVector> {
    // In a real implementation this would fetch the session from storage
    throw new Error(`[BehavioralAIEngine] Session ${sessionId} not found in memory — use captureBehavior() first`);
  }

  // ── Pipeline step 3: Detect anomalies ────────────────────────

  async detectAnomalies(
    tenantId: string,
    employeeId: string,
    features: BehavioralFeatureVector,
  ): Promise<AnomalyDetection[]> {
    const key = `${tenantId}::${employeeId}`;
    const recent = this.recentFeatures.get(key)?.filter(f => f.session_id !== features.session_id) ?? [];

    const result = this.anomalyModel.detect(tenantId, employeeId, features, recent);
    return result.anomalies;
  }

  // ── Pipeline step 4: Risk assessment ─────────────────────────

  assessRisk(
    tenantId: string,
    employeeId: string,
    anomalies: AnomalyDetection[],
    biometricRiskScore?: number,
  ): BehavioralRiskAssessment {
    return this.riskScoring.assess(tenantId, employeeId, anomalies, biometricRiskScore);
  }

  // ── Pipeline step 4b: Unified Risk Score (5 pillars) ────────

  /**
   * Unified risk: biometric + liveness + device + geo + behavior.
   * Returns decision: allow / flag / challenge / require_manager_approval / block.
   */
  assessUnifiedRisk(
    input: UnifiedRiskInput,
    anomalyContext?: { count: number; types: AnomalyDetection['anomaly_type'][] },
  ): UnifiedRiskAssessment {
    return this.unifiedRisk.assess(input, anomalyContext);
  }

  // ── Pipeline step 5: Pattern matching ────────────────────────

  matchFraudPatterns(
    features: BehavioralFeatureVector,
    anomalies: AnomalyDetection[],
  ): FraudIncident[] {
    const profile = this.profileManager.getProfile(features.tenant_id, features.employee_id);
    if (!profile) return [];

    const deviations = this.profileManager.computeDeviations(profile, features);
    return this.fraudDB.matchPatterns(
      features.tenant_id, features.employee_id,
      features.session_id, deviations, anomalies,
    );
  }

  // ── Pipeline step 6: Feedback & Adaptive Learning ────────────

  async submitFeedback(feedback: LearningFeedback): Promise<void> {
    this.adaptiveLearning.submitFeedback(feedback);
  }

  /**
   * Manager approved a flagged registration → recalibrate baseline + reduce FP.
   * Manager confirmed fraud → tighten tolerance.
   */
  processManagerApproval(feedback: import('./adaptive-learning-module').ManagerApprovalFeedback): void {
    this.adaptiveLearning.processManagerApproval(feedback);
  }

  // ── Profile access & Shared-Device Detection ─────────────────

  getProfile(tenantId: string, employeeId: string): BehaviorProfile | null {
    return this.profileManager.getProfile(tenantId, employeeId);
  }

  /**
   * Detect pairs of employees with excessively similar behavioral baselines.
   * Indicates shared device, proxy clocking, or credential sharing.
   */
  detectSharedProfiles(tenantId: string, threshold?: number) {
    return this.profileManager.detectSharedProfiles(tenantId, threshold);
  }

  // ═══════════════════════════════════════════════════════════════
  // FULL PIPELINE — convenience for WorkTimeEngine integration
  // ═══════════════════════════════════════════════════════════════

  async runFullPipeline(
    session: BehaviorCaptureSession,
    biometricRiskScore?: number,
  ): Promise<{
    features: BehavioralFeatureVector;
    anomalies: AnomalyDetection[];
    risk: BehavioralRiskAssessment;
    incidents: FraudIncident[];
    behavior_flagged: boolean;
    anomaly_score: number;
  }> {
    // ── SECURITY: Anonymize + extract + purge raw data ──
    const anonSession = await anonymizeSession(session);
    const rawFeatures = this.featureExtractor.extract(anonSession);
    const features = sanitizeFeatureVector(rawFeatures);
    purgeRawSamples(anonSession);

    this.profileManager.updateProfile(anonSession.tenant_id, anonSession.employee_id, features);

    // Store recent vectors (no raw data)
    const key = `${anonSession.tenant_id}::${anonSession.employee_id}`;
    const recent = this.recentFeatures.get(key) ?? [];
    recent.push(features);
    if (recent.length > BehavioralAIEngine.MAX_RECENT) recent.shift();
    this.recentFeatures.set(key, recent);

    // 2. Anomaly detection
    const detectResult = this.anomalyModel.detect(
      session.tenant_id, session.employee_id, features,
      recent.filter(f => f.session_id !== features.session_id),
    );
    const anomalies = detectResult.anomalies;
    const behavior_flagged = detectResult.behavior_flagged;

    // 3. Risk scoring (merged with biometric)
    const risk = this.riskScoring.assess(
      session.tenant_id, session.employee_id, anomalies, biometricRiskScore,
    );

    // 4. Pattern matching
    const profile = this.profileManager.getProfile(session.tenant_id, session.employee_id);
    let incidents: FraudIncident[] = [];
    if (profile && profile.maturity !== 'nascent') {
      const deviations = this.profileManager.computeDeviations(profile, features);
      incidents = this.fraudDB.matchPatterns(
        session.tenant_id, session.employee_id,
        features.session_id, deviations, anomalies,
      );
    }

    // 5. Observability
    if (incidents.length > 0) {
      incidents.forEach(i =>
        incrementFraudFlags({ fraud_type: i.pattern_category, severity: risk.risk_level }),
      );
    }

    return { features, anomalies, risk, incidents, behavior_flagged, anomaly_score: detectResult.anomaly_score };
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _instance: BehavioralAIEngine | null = null;

export function getBehavioralAIEngine(): BehavioralAIEngine {
  if (!_instance) _instance = new BehavioralAIEngine();
  return _instance;
}
