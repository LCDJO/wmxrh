/**
 * CircuitBreakerManager — Per-module circuit breaker state machines.
 *
 * States: closed → open → half_open → closed (or back to open)
 */

import type { CircuitBreakerState, CircuitState } from './types';

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30_000;

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreakerState>();

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
    return cb.state;
  }

  recordSuccess(moduleId: string): CircuitState {
    const cb = this.getOrCreate(moduleId);
    cb.success_count++;
    cb.last_success_at = Date.now();

    if (cb.state === 'half_open') {
      cb.state = 'closed';
      cb.failure_count = 0;
      cb.opened_at = null;
      cb.half_open_at = null;
    }
    return cb.state;
  }

  /** Check if cooldown has elapsed and transition open → half_open */
  tick(moduleId: string): CircuitState {
    const cb = this.getOrCreate(moduleId);
    if (cb.state === 'open' && cb.opened_at) {
      if (Date.now() - cb.opened_at >= cb.cooldown_ms) {
        cb.state = 'half_open';
        cb.half_open_at = Date.now();
      }
    }
    return cb.state;
  }

  isOpen(moduleId: string): boolean {
    const cb = this.breakers.get(moduleId);
    return cb?.state === 'open';
  }

  reset(moduleId: string): void {
    const cb = this.breakers.get(moduleId);
    if (cb) {
      cb.state = 'closed';
      cb.failure_count = 0;
      cb.success_count = 0;
      cb.opened_at = null;
      cb.half_open_at = null;
    }
  }

  listAll(): CircuitBreakerState[] {
    return [...this.breakers.values()];
  }

  getState(moduleId: string): CircuitState {
    return this.breakers.get(moduleId)?.state ?? 'closed';
  }
}
