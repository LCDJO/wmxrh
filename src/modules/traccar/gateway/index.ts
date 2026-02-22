/**
 * Traccar Module Gateway — Data access via sandbox
 *
 * Platform layer: global config (platform_settings)
 * Tenant layer: device mappings, speed policies, enforcement points, disciplinary policies
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createTraccarGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;

  return {
    // ── Platform Layer ──
    getPlatformConfig: () =>
      gateway.query<unknown>('platform_settings', 'get', { key: 'traccar_config' }),

    updatePlatformConfig: (config: Record<string, unknown>) =>
      gateway.mutate('platform_settings', 'upsert', { key: 'traccar_config', value: config }),

    // ── Tenant Layer ──
    getTenantConfig: (tenantId: string) =>
      gateway.query<unknown>('tenant_traccar_configs', 'get', { tenant_id: tenantId }),

    listDeviceMappings: (tenantId: string) =>
      gateway.query<unknown[]>('tenant_device_mappings', 'list', { tenant_id: tenantId }),

    mapDevice: (data: Record<string, unknown>) =>
      gateway.mutate('tenant_device_mappings', 'create', data),

    unmapDevice: (id: string) =>
      gateway.mutate('tenant_device_mappings', 'delete', { id }),

    listSpeedPolicies: (tenantId: string) =>
      gateway.query<unknown[]>('tenant_speed_limit_policies', 'list', { tenant_id: tenantId }),

    listEnforcementPoints: (tenantId: string) =>
      gateway.query<unknown[]>('tenant_enforcement_points', 'list', { tenant_id: tenantId }),

    getTrackingEvents: (tenantId: string, params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('raw_tracking_events', 'list', { tenant_id: tenantId, ...params }),
  };
}
