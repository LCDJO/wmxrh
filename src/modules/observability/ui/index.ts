export const ObservabilityModuleUI = {
  loadPlatformStatus: () => import('./PlatformStatusPanel'),
  loadModuleMonitoring: () => import('./ModuleMonitoringPanel'),
  loadErrorTracking: () => import('./ErrorTrackingPanel'),
  loadPerformance: () => import('./PerformancePanel'),
};
