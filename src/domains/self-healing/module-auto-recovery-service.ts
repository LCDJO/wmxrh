/**
 * ModuleAutoRecoveryService — Safe automated module recovery actions.
 *
 * Allowed operations:
 *  - restartModule(module_id)        → deactivate + activate
 *  - disableModuleTemporarily(id,ms) → deactivate + schedule re-activate
 *  - reloadGateway(module_id)        → emit gateway reload event
 *
 * SAFETY: This service NEVER touches tenant data. All operations are
 * scoped to module lifecycle management via ModuleOrchestratorAPI.
 */

import type { GlobalEventKernelAPI, ModuleOrchestratorAPI } from '@/domains/platform-os/types';

export interface RecoveryResult {
  module_id: string;
  action: 'restart' | 'disable_temporarily' | 'reload_gateway';
  success: boolean;
  duration_ms: number;
  error?: string;
}

const DEFAULT_DISABLE_MS = 30_000; // 30s default cooldown

export class ModuleAutoRecoveryService {
  /** Track temporarily disabled modules so we don't stack timers */
  private disabledTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private modules: ModuleOrchestratorAPI,
    private events: GlobalEventKernelAPI,
  ) {}

  // ── restartModule ──────────────────────────────────────────────

  async restartModule(moduleId: string): Promise<RecoveryResult> {
    const start = performance.now();
    try {
      // Graceful deactivate (swallow if already inactive)
      await this.modules.deactivate(moduleId).catch(() => {});
      await this.modules.activate(moduleId);

      this.events.emit('self_healing:module_restarted', 'ModuleAutoRecoveryService', {
        module_id: moduleId,
      });

      return this.ok(moduleId, 'restart', start);
    } catch (err) {
      return this.fail(moduleId, 'restart', start, err);
    }
  }

  // ── disableModuleTemporarily ───────────────────────────────────

  async disableModuleTemporarily(
    moduleId: string,
    cooldownMs: number = DEFAULT_DISABLE_MS,
  ): Promise<RecoveryResult> {
    const start = performance.now();
    try {
      // Clear existing timer if any
      const existing = this.disabledTimers.get(moduleId);
      if (existing) clearTimeout(existing);

      await this.modules.deactivate(moduleId);

      this.events.emit('self_healing:module_disabled_temporarily', 'ModuleAutoRecoveryService', {
        module_id: moduleId, cooldown_ms: cooldownMs,
      }, { priority: 'high' });

      // Schedule re-activation
      const timer = setTimeout(() => {
        this.disabledTimers.delete(moduleId);
        this.modules.activate(moduleId).then(() => {
          this.events.emit('self_healing:module_re_enabled', 'ModuleAutoRecoveryService', {
            module_id: moduleId,
          });
        }).catch(() => {
          // Stay disabled — will be caught by next health check
          this.events.emit('self_healing:module_re_enable_failed', 'ModuleAutoRecoveryService', {
            module_id: moduleId,
          }, { priority: 'high' });
        });
      }, cooldownMs);

      this.disabledTimers.set(moduleId, timer);
      return this.ok(moduleId, 'disable_temporarily', start);
    } catch (err) {
      return this.fail(moduleId, 'disable_temporarily', start, err);
    }
  }

  // ── reloadGateway ──────────────────────────────────────────────

  async reloadGateway(moduleId: string): Promise<RecoveryResult> {
    const start = performance.now();
    try {
      this.events.emit('self_healing:gateway_reload', 'ModuleAutoRecoveryService', {
        module_id: moduleId,
      });

      return this.ok(moduleId, 'reload_gateway', start);
    } catch (err) {
      return this.fail(moduleId, 'reload_gateway', start, err);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  dispose(): void {
    for (const timer of this.disabledTimers.values()) clearTimeout(timer);
    this.disabledTimers.clear();
  }

  // ── Helpers ────────────────────────────────────────────────────

  private ok(moduleId: string, action: RecoveryResult['action'], start: number): RecoveryResult {
    return { module_id: moduleId, action, success: true, duration_ms: Math.round(performance.now() - start) };
  }

  private fail(moduleId: string, action: RecoveryResult['action'], start: number, err: unknown): RecoveryResult {
    return { module_id: moduleId, action, success: false, duration_ms: Math.round(performance.now() - start), error: String(err) };
  }
}
