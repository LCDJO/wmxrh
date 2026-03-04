/**
 * Traccar Integration Module — Manifest
 *
 * ══════════════════════════════════════════════════════════
 * DUAS CAMADAS ARQUITETURAIS:
 * ══════════════════════════════════════════════════════════
 *
 *  1) SAAS INTEGRATION CORE (Platform)
 *     ├── TraccarApiClient         — Autenticação e consumo de APIs Traccar
 *     ├── TraccarSyncService       — Sincronização de dispositivos
 *     ├── EventNormalizer          — Normalização multi-protocolo (OsmAnd, Teltonika, etc.)
 *     ├── EventPublisher           — Publicação em fila de eventos
 *     ├── IntegrationHealthEngine  — Monitoramento por tenant
 *     ├── IntegrityHashEngine      — SHA-256 para auditabilidade
 *     └── ModuleAccessService      — Controle de módulos liberados por plano
 *
 *  2) TENANT FLEET INTELLIGENCE (Tenant)
 *     ├── TripBuilder              — Construção de viagens por ignição/gaps
 *     ├── RadarPointEngine         — Detecção de infrações em radares
 *     ├── BehaviorEngine           — Análise comportamental de motoristas
 *     ├── DriverRiskScoreEngine    — Score de risco ponderado (0-100)
 *     ├── TrafficHotspotAnalyzer   — Grid espacial para heatmaps
 *     ├── BehaviorService          — CRUD de eventos comportamentais
 *     ├── ComplianceService        — Gestão de incidentes de compliance
 *     └── EventHandlers            — Reações a eventos cross-module
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const TRACCAR_MODULE_ID = 'traccar_integration';

export const TRACCAR_MODULE_LAYERS = {
  /** SaaS Integration Core — infraestrutura de integração */
  SAAS_CORE: 'traccar:saas_integration_core',
  /** Tenant Fleet Intelligence — lógica de negócio por tenant */
  FLEET_INTELLIGENCE: 'traccar:tenant_fleet_intelligence',
  /** @deprecated Use SAAS_CORE */
  PLATFORM: 'traccar:platform_config',
  /** @deprecated Use FLEET_INTELLIGENCE */
  TENANT: 'traccar:tenant_config',
} as const;

export const TRACCAR_EVENTS = {
  // ── SaaS Integration Core Events ──
  PLATFORM_CONFIG_UPDATED: `module:${TRACCAR_MODULE_ID}:platform_config_updated`,
  PLATFORM_CONNECTION_TESTED: `module:${TRACCAR_MODULE_ID}:platform_connection_tested`,
  PLATFORM_DISCONNECTED: `module:${TRACCAR_MODULE_ID}:platform_disconnected`,
  DEVICE_SYNCED: `module:${TRACCAR_MODULE_ID}:device_synced`,
  EVENT_NORMALIZED: `module:${TRACCAR_MODULE_ID}:event_normalized`,
  EVENT_PUBLISHED: `module:${TRACCAR_MODULE_ID}:event_published`,
  HEALTH_CHECK_COMPLETED: `module:${TRACCAR_MODULE_ID}:health_check_completed`,

  // ── Tenant Fleet Intelligence Events ──
  TENANT_INTEGRATION_ENABLED: `module:${TRACCAR_MODULE_ID}:tenant_integration_enabled`,
  TENANT_INTEGRATION_DISABLED: `module:${TRACCAR_MODULE_ID}:tenant_integration_disabled`,
  DEVICE_MAPPED: `module:${TRACCAR_MODULE_ID}:device_mapped`,
  DEVICE_UNMAPPED: `module:${TRACCAR_MODULE_ID}:device_unmapped`,
  SPEED_VIOLATION_DETECTED: `module:${TRACCAR_MODULE_ID}:speed_violation_detected`,
  GEOFENCE_VIOLATION_DETECTED: `module:${TRACCAR_MODULE_ID}:geofence_violation_detected`,
  TRACKING_EVENT_INGESTED: `module:${TRACCAR_MODULE_ID}:tracking_event_ingested`,
  DISCIPLINARY_ACTION_TRIGGERED: `module:${TRACCAR_MODULE_ID}:disciplinary_action_triggered`,
  BEHAVIOR_EVENT_RECORDED: `module:${TRACCAR_MODULE_ID}:behavior_event_recorded`,
  RISK_SCORE_COMPUTED: `module:${TRACCAR_MODULE_ID}:risk_score_computed`,
} as const;

export function initTraccarModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('layers', [
    TRACCAR_MODULE_LAYERS.SAAS_CORE,
    TRACCAR_MODULE_LAYERS.FLEET_INTELLIGENCE,
  ]);
  sandbox.emit('initialized', {
    module: TRACCAR_MODULE_ID,
    layers: TRACCAR_MODULE_LAYERS,
    architecture: {
      saas_core: [
        'TraccarApiClient',
        'TraccarSyncService',
        'EventNormalizer',
        'EventPublisher',
        'IntegrationHealthEngine',
        'IntegrityHashEngine',
        'ModuleAccessService',
      ],
      fleet_intelligence: [
        'TripBuilder',
        'RadarPointEngine',
        'BehaviorEngine',
        'DriverRiskScoreEngine',
        'TrafficHotspotAnalyzer',
        'BehaviorService',
        'ComplianceService',
        'EventHandlers',
      ],
    },
  });
}
