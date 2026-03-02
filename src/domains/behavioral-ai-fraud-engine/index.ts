/**
 * Behavioral Biometrics & AI Fraud Pattern Engine — Barrel Export
 *
 * Detecção de fraude comportamental no módulo de ponto,
 * mesmo quando biometria facial é válida.
 *
 * Arquitetura:
 *   BehavioralAIEngine (Facade)
 *    ├── BehaviorCaptureSDK         — Coleta client-side de touch/motion/keyboard
 *    ├── FeatureExtractionService   — Extração de feature vectors estatísticos
 *    ├── BehaviorProfileManager     — Baseline por colaborador (EMA)
 *    ├── AnomalyDetectionModel      — Z-score + bot + replay detection
 *    ├── BehavioralRiskScoringEngine — Score ponderado com merge biométrico
 *    ├── UnifiedRiskScoringEngine   — Score unificado (5 pilares)
 *    ├── FraudPatternDatabase       — Catálogo de padrões (buddy punch, bot, proxy)
 *    └── AdaptiveLearningModule     — Feedback loop + Bayesian tuning
 *
 * Integrações:
 *   - WorkTimeEngine          (enriquecimento de clock events)
 *   - BiometricTrustLayer     (score combinado)
 *   - GeoFenceValidator       (fraude de localização)
 *   - DeviceIntegrityValidator (sinais de dispositivo)
 *   - AccountEnforcementEngine (escalação → ban)
 *   - ObservabilityCore       (métricas Prometheus)
 */

export { BehavioralAIEngine, getBehavioralAIEngine } from './behavioral-ai-engine';
export { BehaviorCaptureSDK } from './behavior-capture-sdk';
export { FeatureExtractionService } from './feature-extraction-service';
export { BehaviorProfileManager } from './behavior-profile-manager';
export { AnomalyDetectionModel } from './anomaly-detection-model';
export { BehavioralRiskScoringEngine } from './behavioral-risk-scoring-engine';
export { UnifiedRiskScoringEngine } from './unified-risk-scoring-engine';
export { FraudPatternDatabase } from './fraud-pattern-database';
export { AdaptiveLearningModule } from './adaptive-learning-module';
export { purgeRawSamples, sanitizeFeatureVector, anonymizeSession, hashFingerprint } from './behavior-data-sanitizer';
export type * from './types';
