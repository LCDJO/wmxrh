/**
 * ══════════════════════════════════════════════════════════
 * SaaS Integration Core — Camada Platform
 * ══════════════════════════════════════════════════════════
 *
 * Responsável por:
 *  ├── Autenticação com servidores Traccar
 *  ├── Consumo das APIs /devices /positions /events
 *  ├── Sincronização de dispositivos
 *  ├── Normalização de eventos
 *  ├── Publicação em fila de eventos
 *  ├── Monitoramento de integração por tenant
 *  └── Controle de módulos liberados por plano
 *
 * Esta camada NÃO contém lógica de negócio do tenant.
 * Apenas infraestrutura de integração e ingestão de dados.
 */

// ── Traccar API Client (autenticação + consumo de APIs) ──
export { traccarApi } from '../services/traccar-api-client';
export type {
  TraccarDevice,
  TraccarPosition,
  TraccarEvent,
  TraccarGeofence,
  TraccarNotification,
  TraccarGroup,
  TraccarDriver,
  TraccarMaintenance,
  TraccarCommand,
  TraccarReportSummary,
  TraccarReportTrip,
  TraccarReportStop,
  TraccarServerInfo,
  TraccarStatistics,
} from '../services/traccar-api-client';

// ── Sincronização de dispositivos ──
export {
  triggerTraccarSync,
  getCachedDevices,
  linkDeviceToEmployee,
  getSyncHealth,
  testTraccarHealth,
} from '../services/traccar-sync.service';
export type { SyncResult, DeviceCacheEntry } from '../services/traccar-sync.service';

// ── Normalização de eventos (Platform Layer) ──
export {
  normalizeTraccarEvent,
  computeIntegrityHashSync,
  computeIntegrityHashAsync,
  validateWebhookRequest,
  buildDispatchManifest,
} from '@/layers/platform/traccar-integration.core';
export type {
  TraccarCanonicalEvent,
  TraccarOsmAndPayload,
  TraccarWebhookPayload,
  TraccarWebhookValidation,
  TraccarDispatchResult,
} from '@/layers/platform/traccar-integration.core';

// ── Monitoramento de integração por tenant ──
export {
  getLatestHealthChecks,
  getTenantHealthHistory,
  triggerHealthCheck,
  getActiveHealthAlerts,
  getTenantHealthAlerts,
  resolveHealthAlert,
  getTokenOwnersByTenant,
} from '../services/integration-health.service';
export type {
  HealthCheckResult,
  CheckResult,
  HealthAlert,
  TraccarTokenOwner,
} from '../services/integration-health.service';

// ── Controle de módulos liberados por plano ──
export {
  resolveTraccarModuleAccess,
  getTraccarModuleKeys,
  isFleetIntelligenceEnabled,
  type TraccarModuleAccessResult,
} from './module-access.service';

// ── Publicação em fila de eventos ──
export {
  publishTraccarEvent,
  publishBatchTraccarEvents,
  type TraccarEventPublishPayload,
} from './event-publisher.service';
