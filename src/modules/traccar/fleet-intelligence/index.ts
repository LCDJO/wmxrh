/**
 * ══════════════════════════════════════════════════════════
 * Tenant Fleet Intelligence — Camada Tenant
 * ══════════════════════════════════════════════════════════
 *
 * Responsável por:
 *  ├── Análise comportamental de motoristas (BTIE)
 *  ├── Construção de viagens (TripBuilder)
 *  ├── Detecção de infrações em radares (RadarPointEngine)
 *  ├── Score de risco por motorista (DriverRiskScore)
 *  ├── Análise de hotspots de tráfego
 *  ├── Gestão de eventos comportamentais
 *  ├── Gestão de incidentes de compliance
 *  └── Handlers de eventos cross-module
 *
 * Consome eventos normalizados da camada SaaS Integration Core.
 * Toda lógica de negócio do tenant está aqui.
 */

// ── BTIE Engines (lógica pura, sem I/O) ──
export { buildTrips, attachViolationsToTrips } from '../engines/trip-builder';
export { detectRadarViolations } from '../engines/radar-point-engine';
export { analyzeBehavior, radarViolationsToBehavior } from '../engines/behavior-engine';
export type { BehaviorConfig } from '../engines/behavior-engine';
export { computeDriverRiskScore, computeBatchDriverScores } from '../engines/driver-risk-score-engine';
export type { ScoreInput } from '../engines/driver-risk-score-engine';
export { analyzeHotspots } from '../engines/traffic-hotspot-analyzer';
export type { HotspotConfig } from '../engines/traffic-hotspot-analyzer';

// ── Tipos compartilhados dos engines ──
export type {
  PositionPoint,
  TripSummary,
  RadarPoint,
  RadarViolationEvent,
  BehaviorEvent as BtieEvent,
  BehaviorEventKind,
  DriverRiskScore,
  TrafficHotspot,
  HotspotGrid,
} from '../engines/types';

// ── Serviço de eventos comportamentais (I/O com banco) ──
export {
  getBehaviorEvents,
  getBehaviorSummary,
  recordBehaviorEvent,
  evaluateSpeedSeverity,
} from '../services/behavior-engine.service';
export type {
  BehaviorEvent,
  BehaviorSummary,
  BehaviorEventType,
} from '../services/behavior-engine.service';

// ── Serviço de compliance (I/O com banco) ──
export {
  getComplianceIncidents,
  getComplianceSummary,
  createComplianceIncident,
  reviewIncident,
} from '../services/compliance.service';
export type {
  ComplianceIncident,
  ComplianceSummary,
} from '../services/compliance.service';

// ── Event handlers cross-module ──
export { registerTraccarEventHandlers } from '../events';
