/**
 * Traccar Integration Module — Manifest
 *
 * Duas camadas:
 *  1) PLATFORM — Configuração global do servidor Traccar (SaaS admin)
 *  2) TENANT   — Mapeamento de dispositivos, políticas e integração por cliente
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const TRACCAR_MODULE_ID = 'traccar_integration';

export const TRACCAR_MODULE_LAYERS = {
  PLATFORM: 'traccar:platform_config',
  TENANT: 'traccar:tenant_config',
} as const;

export const TRACCAR_EVENTS = {
  // Platform-level
  PLATFORM_CONFIG_UPDATED: `module:${TRACCAR_MODULE_ID}:platform_config_updated`,
  PLATFORM_CONNECTION_TESTED: `module:${TRACCAR_MODULE_ID}:platform_connection_tested`,
  PLATFORM_DISCONNECTED: `module:${TRACCAR_MODULE_ID}:platform_disconnected`,

  // Tenant-level
  TENANT_INTEGRATION_ENABLED: `module:${TRACCAR_MODULE_ID}:tenant_integration_enabled`,
  TENANT_INTEGRATION_DISABLED: `module:${TRACCAR_MODULE_ID}:tenant_integration_disabled`,
  DEVICE_MAPPED: `module:${TRACCAR_MODULE_ID}:device_mapped`,
  DEVICE_UNMAPPED: `module:${TRACCAR_MODULE_ID}:device_unmapped`,
  SPEED_VIOLATION_DETECTED: `module:${TRACCAR_MODULE_ID}:speed_violation_detected`,
  GEOFENCE_VIOLATION_DETECTED: `module:${TRACCAR_MODULE_ID}:geofence_violation_detected`,
  TRACKING_EVENT_INGESTED: `module:${TRACCAR_MODULE_ID}:tracking_event_ingested`,
  DISCIPLINARY_ACTION_TRIGGERED: `module:${TRACCAR_MODULE_ID}:disciplinary_action_triggered`,
} as const;

/**
 * Arquitetura interna:
 *
 * TraccarModule
 *  ├── PlatformTraccarConfig     — Config global do servidor (URL, token, protocolo)
 *  ├── TenantTraccarSettings     — Painel tenant para mapeamento e políticas
 *  ├── TraccarIngestEngine        — Edge Function de ingestão (webhook)
 *  ├── TraccarNormalizer          — Normalização de payloads multi-protocolo
 *  ├── IntegrityHashEngine        — SHA-256 para auditabilidade
 *  ├── SpeedPolicyEnforcer        — Avaliação de limites e zonas
 *  ├── DisciplinaryPolicyEngine   — Escalonamento progressivo
 *  └── DeviceMappingService       — CRUD de dispositivos por tenant
 */

export function initTraccarModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('layers', Object.values(TRACCAR_MODULE_LAYERS));
  sandbox.emit('initialized', {
    module: TRACCAR_MODULE_ID,
    layers: TRACCAR_MODULE_LAYERS,
  });
}
