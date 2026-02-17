/**
 * CircuitBreakerManager — Per-module circuit breaker state machines.
 *
 * States: closed → open → half_open → closed (or back to open)
 *
 * Features:
 *  - Configurable threshold & cooldown per module
 *  - Fallback registry: callers can execute via `callWithBreaker`
 *  - Event emission for state transitions (when eventKernel is set)
 */

import type { CircuitBreakerState, CircuitState } from './types';
import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30_000;

export type FallbackFn<T = unknown> = (moduleId: string) => T | Promise<T>;

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreakerState>();
  private fallbacks = new Map<string, FallbackFn>();
  private eventKernel: GlobalEventKernelAPI | null = null;

  /** Optionally wire to GlobalEventKernel for state-change events */
  setEventKernel(events: GlobalEventKernelAPI): void {
    this.eventKernel = events;
  }

  // ── Fallback registry ─────────────────────────────────────────

  registerFallback<T>(moduleId: string, fn: FallbackFn<T>): void {
    this.fallbacks.set(moduleId, fn as FallbackFn);
  }

  removeFallback(moduleId: string): void {
    this.fallbacks.delete(moduleId);
  }

  /**
   * Execute `fn` only if the circuit is not open.
   * If open, routes to registered fallback (or throws).
   * Records success/failure automatically.
   */
  async callWithBreaker<T>(
    moduleId: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const state = this.getState(moduleId);

    if (state === 'open') {
      const fallback = this.fallbacks.get(moduleId);
      if (fallback) {
        return fallback(moduleId) as Promise<T>;
      }
      throw new Error(`[CircuitBreaker] Circuit open for ${moduleId} — no fallback registered`);
    }

    try {
      const result = await fn();
      this.recordSuccess(moduleId);
      return result;
    } catch (err) {
      this.recordFailure(moduleId);
      // If circuit just opened, try fallback
      if (this.getState(moduleId) === 'open') {
        const fallback = this.fallbacks.get(moduleId);
        if (fallback) {
          return fallback(moduleId) as Promise<T>;
        }
      }
      throw err;
    }
  }

  // ── Core state management ─────────────────────────────────────

  getOrCreate(moduleId: string): CircuitBreakerState {
    let cb = this.breakers.get(moduleId);
    if (!cb) {
      cb = {
        module_id: moduleId,
        state: 'closed',
        failure_count: 0,
        success_count: 0,
        last_failure_at: null,
        last_success_at: null,
        opened_at: null,
        half_open_at: null,
        threshold: DEFAULT_THRESHOLD,
        cooldown_ms: DEFAULT_COOLDOWN_MS,
      };
      this.breakers.set(moduleId, cb);
    }
    return cb;
  }

  recordFailure(moduleId: string): CircuitState {
    const cb = this.getOrCreate(moduleId);
    const prev = cb.state;
    cb.failure_count++;
    cb.last_failure_at = Date.now();
    cb.success_count = 0;

    if (cb.state === 'half_open') {
      cb.state = 'open';
      cb.opened_at = Date.now();
    } else if (cb.state === 'closed' && cb.failure_count >= cb.threshold) {
      cb.state = 'open';
      cb.opened_at = Date.now();
    }

    if (prev !== cb.state) this.emitTransition(moduleId, prev, cb.state);
    return cb.state;
  }

  recordSuccess(moduleId: string): CircuitState {
    const cb = this.getOrCreate(moduleId);
    const prev = cb.state;
    cb.success_count++;
    cb.last_success_at = Date.now();

    if (cb.state === 'half_open') {
      cb.state = 'closed';
      cb.failure_count = 0;
      cb.opened_at = null;
      cb.half_open_at = null;
    }

    if (prev !== cb.state) this.emitTransition(moduleId, prev, cb.state);
    return cb.state;
  }

  /** Check if cooldown has elapsed and transition open → half_open */
  tick(moduleId: string): CircuitState {
    const cb = this.getOrCreate(moduleId);
    const prev = cb.state;
    if (cb.state === 'open' && cb.opened_at) {
      if (Date.now() - cb.opened_at >= cb.cooldown_ms) {
        cb.state = 'half_open';
        cb.half_open_at = Date.now();
      }
    }
    if (prev !== cb.state) this.emitTransition(moduleId, prev, cb.state);
    return cb.state;
  }

  isOpen(moduleId: string): boolean {
    const cb = this.breakers.get(moduleId);
    return cb?.state === 'open';
  }

  /** Returns list of module IDs with open or half_open circuits */
  getDegradedModules(): string[] {
    return [...this.breakers.values()]
      .filter(cb => cb.state === 'open' || cb.state === 'half_open')
      .map(cb => cb.module_id);
  }

  reset(moduleId: string): void {
    const cb = this.breakers.get(moduleId);
    if (cb) {
      const prev = cb.state;
      cb.state = 'closed';
      cb.failure_count = 0;
      cb.success_count = 0;
      cb.opened_at = null;
      cb.half_open_at = null;
      if (prev !== 'closed') this.emitTransition(moduleId, prev, 'closed');
    }
  }

  listAll(): CircuitBreakerState[] {
    return [...this.breakers.values()];
  }

  getState(moduleId: string): CircuitState {
    return this.breakers.get(moduleId)?.state ?? 'closed';
  }

  // ── Private ───────────────────────────────────────────────────

  private emitTransition(moduleId: string, from: CircuitState, to: CircuitState): void {
    this.eventKernel?.emit('self_healing:circuit_transition', 'CircuitBreakerManager', {
      module_id: moduleId, from, to,
    }, { priority: to === 'open' ? 'critical' : 'high' });
  }
}
