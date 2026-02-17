/**
 * ModuleControlCenter — Enhanced module view with circuit breaker state,
 * dependency graph, and error metrics for the Control Plane.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { ModuleControlInfo } from './types';
import { getErrorTracker } from '@/domains/observability/error-tracker';

export class ModuleControlCenter {
  constructor(private runtime: PlatformRuntimeAPI) {}

  getAll(): ModuleControlInfo[] {
    const modules = this.runtime.modules.list();
    const depGraph = this.runtime.modules.dependencyGraph();
    const errorTracker = getErrorTracker();
    const errors = errorTracker.getErrors();
    const oneHourAgo = Date.now() - 3600000;

    return modules.map(mod => {
      // Find dependents (who depends on this module)
      const dependents: string[] = [];
      for (const [key, deps] of Object.entries(depGraph)) {
        if (deps.includes(mod.key)) dependents.push(key);
      }

      // Count recent errors for this module
      const moduleErrors = errors
        .filter(e => e.source === mod.key && e.first_seen > oneHourAgo)
        .reduce((sum, e) => sum + e.count, 0);

      return {
        key: mod.key,
        label: mod.label,
        status: mod.status,
        version: mod.version,
        is_core: mod.is_core,
        circuit_breaker_state: mod.status === 'error' ? 'open' : 'closed',
        dependencies: [...mod.dependencies],
        dependents,
        error_count_last_hour: moduleErrors,
        last_activated_at: mod.activated_at,
      } satisfies ModuleControlInfo;
    });
  }
}
