/**
 * Traccar Module UI — Lazy-loadable components
 *
 * Platform: TraccarConnectCard (global server config)
 * Tenant: TenantTraccarSettings (device mapping, policies, events)
 */
export const TraccarModuleUI = {
  /** Platform-level: Config card for /platform/settings/saas */
  loadPlatformConfig: () => import('@/components/platform/TraccarConnectCard'),

  /** Tenant-level: Full settings page for /integrations/traccar */
  loadTenantSettings: () => import('./TenantTraccarSettings'),
};
