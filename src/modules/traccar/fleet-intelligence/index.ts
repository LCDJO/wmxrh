/**
 * ══════════════════════════════════════════════════════════
 * Tenant Fleet Intelligence — Camada Tenant
 * ══════════════════════════════════════════════════════════
 *
 * Responsável por:
 *  ├── Configuração da integração Traccar
 *  ├── Vinculação de dispositivos a colaboradores e veículos
 *  ├── Definição de parâmetros comportamentais
 *  ├── Cadastro de pontos de radar
 *  ├── Análise de trajetos e velocidade
 *  ├── Geração de infrações e alertas
 *  ├── Dashboards operacionais e analíticos
 *  ├── Construção de viagens (TripBuilder)
 *  ├── Detecção de infrações em radares (RadarPointEngine)
 *  ├── Score de risco por motorista (DriverRiskScore)
 *  ├── Análise de hotspots de tráfego
 *  └── Handlers de eventos cross-module
 *
 * Consome eventos normalizados da camada SaaS Integration Core.
 * Toda lógica de negócio do tenant está aqui.
 */

// ══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DA INTEGRAÇÃO
// ══════════════════════════════════════════════════════════
export {
  getTenantTraccarConfig,
  saveTenantTraccarConfig,
  deactivateTenantTraccar,
} from './tenant-config.service';
export type {
  TenantTraccarConfigRow,
  SaveTenantTraccarConfigDTO,
} from './tenant-config.service';

// ══════════════════════════════════════════════════════════
// VINCULAÇÃO DE DISPOSITIVOS
// ══════════════════════════════════════════════════════════
export {
  listDeviceMappings,
  linkDevice,
  unlinkDevice,
  getUnlinkedDevices,
  getDeviceByEmployee,
} from './device-mapping.service';
export type {
  DeviceMapping,
  CreateDeviceMappingDTO,
  UpdateDeviceMappingDTO,
} from './device-mapping.service';

// ══════════════════════════════════════════════════════════
// PARÂMETROS COMPORTAMENTAIS
// ══════════════════════════════════════════════════════════
export {
  getTenantBehavioralParams,
  toBehaviorConfig,
  getDefaultBehavioralParams,
} from './behavioral-params.service';
export type { TenantBehavioralParams } from './behavioral-params.service';

// ══════════════════════════════════════════════════════════
// CADASTRO DE PONTOS DE RADAR
// ══════════════════════════════════════════════════════════
export {
  listRadarPoints,
  listActiveRadarPoints,
  createRadarPoint,
  updateRadarPoint,
  deactivateRadarPoint,
  deleteRadarPoint,
  importRadarPoints,
} from './radar-point.service';
export type {
  RadarPointRow,
  CreateRadarPointDTO as CreateRadarDTO,
  UpdateRadarPointDTO as UpdateRadarDTO,
} from './radar-point.service';

// ══════════════════════════════════════════════════════════
// ANÁLISE DE TRAJETOS E VELOCIDADE
// ══════════════════════════════════════════════════════════
export {
  analyzeTrips,
  getDailyTrips,
  getEmployeeTrips,
} from './trip-analysis.service';
export type {
  TripAnalysisResult,
  TripAnalysisOptions,
} from './trip-analysis.service';

// ══════════════════════════════════════════════════════════
// GERAÇÃO DE INFRAÇÕES E ALERTAS
// ══════════════════════════════════════════════════════════
export {
  generateInfractions,
  evaluateEmployeeEscalation,
  getFleetAlerts,
  getInfractionCountsByEmployee,
} from './infraction-alert.service';
export type {
  FleetInfraction,
  FleetAlert,
  GenerateInfractionsResult,
} from './infraction-alert.service';

// ══════════════════════════════════════════════════════════
// BTIE ENGINES (lógica pura, sem I/O)
// ══════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════
// SERVIÇOS DE DADOS (I/O com banco)
// ══════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════
// PIPELINE ORQUESTRADOR
// ══════════════════════════════════════════════════════════
export {
  executePipeline,
  executeLightPipeline,
} from './fleet-data-pipeline';
export type {
  PipelineExecutionResult,
  PipelineOptions,
} from './fleet-data-pipeline';

// ── Event handlers cross-module ──
export { registerTraccarEventHandlers } from '../events';
