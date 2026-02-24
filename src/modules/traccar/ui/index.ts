/**
 * Traccar Module UI — Lazy-loadable components
 */
export const TraccarModuleUI = {
  loadPlatformConfig: () => import('@/components/platform/TraccarConnectCard'),
  loadTenantSettings: () => import('./TenantTraccarSettings'),
  loadFleetDashboard: () => import('./FleetDashboard'),
};

export { FleetMap } from './FleetMap';
export { InfractionsList } from './InfractionsList';
export { DeviceProfile } from './DeviceProfile';
export { useMapboxToken } from './useMapboxToken';
