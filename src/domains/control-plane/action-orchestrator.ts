/**
 * ActionOrchestrator — Executes control actions on platform subsystems.
 *
 * SECURITY INVARIANT: Only operates on logical infrastructure.
 * Never mutates roles, permissions, plans, or policies.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { ControlAction, ActionResult } from './types';

export class ActionOrchestrator {
  private log: ActionResult[] = [];

  constructor(private runtime: PlatformRuntimeAPI) {}

  execute(action: ControlAction): ActionResult {
    let result: ActionResult;

    try {
      switch (action.type) {
        case 'restart_module': {
          const mod = this.runtime.modules.get(action.module_key);
          if (!mod) {
            result = this.fail(action, `Module '${action.module_key}' not found`);
            break;
          }
          // Deactivate then reactivate
          this.runtime.modules.deactivate(action.module_key)
            .then(() => this.runtime.modules.activate(action.module_key))
            .catch(err => console.error('[APCP] Restart failed:', err));
          result = this.ok(action, `Module '${action.module_key}' restart initiated`);
          break;
        }

        case 'deactivate_module': {
          const mod = this.runtime.modules.get(action.module_key);
          if (!mod) {
            result = this.fail(action, `Module '${action.module_key}' not found`);
            break;
          }
          if (mod.is_core) {
            result = this.fail(action, `Cannot deactivate core module '${action.module_key}'`);
            break;
          }
          this.runtime.modules.deactivate(action.module_key)
            .catch(err => console.error('[APCP] Deactivate failed:', err));
          result = this.ok(action, `Module '${action.module_key}' deactivation initiated`);
          break;
        }

        case 'activate_module': {
          this.runtime.modules.activate(action.module_key)
            .catch(err => console.error('[APCP] Activate failed:', err));
          result = this.ok(action, `Module '${action.module_key}' activation initiated`);
          break;
        }

        case 'toggle_feature': {
          this.runtime.features.toggle(action.feature_key, action.enabled);
          result = this.ok(action, `Feature '${action.feature_key}' set to ${action.enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'clear_circuit_breaker': {
          // Attempt to reactivate a module to reset its circuit breaker
          this.runtime.modules.activate(action.module_key)
            .catch(err => console.error('[APCP] Circuit reset failed:', err));
          result = this.ok(action, `Circuit breaker reset for '${action.module_key}'`);
          break;
        }

        case 'flush_caches': {
          result = this.ok(action, 'Cache flush requested (delegated to subsystems)');
          this.runtime.events.emit('controlplane:cache_flush', 'APCP.ActionOrchestrator', {});
          break;
        }

        case 'force_health_check': {
          result = this.ok(action, 'Health check initiated');
          this.runtime.events.emit('controlplane:health_check_requested', 'APCP.ActionOrchestrator', {});
          break;
        }

        default:
          result = this.fail(action, 'Unknown action type');
      }
    } catch (err) {
      result = this.fail(action, String(err));
    }

    this.log.push(result);
    if (this.log.length > 100) this.log.shift();

    this.runtime.events.emit('controlplane:action_executed', 'APCP.ActionOrchestrator', result);
    return result;
  }

  getLog(): ActionResult[] {
    return this.log.slice(-50);
  }

  private ok(action: ControlAction, message: string): ActionResult {
    return { action, success: true, message, executed_at: Date.now() };
  }

  private fail(action: ControlAction, message: string): ActionResult {
    return { action, success: false, message, executed_at: Date.now() };
  }
}
