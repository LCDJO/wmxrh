/**
 * ErrorTracker — Captures, deduplicates, and aggregates errors.
 */

import type { TrackedError, ErrorSummary, ErrorSeverity } from './types';
import { getMetricsCollector } from './metrics-collector';

const MAX_ERRORS = 200;
const DEDUP_WINDOW_MS = 60_000;

class ErrorTracker {
  private errors: TrackedError[] = [];
  private listeners = new Set<() => void>();

  capture(error: {
    message: string;
    stack?: string;
    source?: TrackedError['source'];
    severity?: ErrorSeverity;
    module_id?: string;
    user_id?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }) {
    const now = Date.now();
    const fingerprint = `${error.message}|${error.source ?? 'frontend'}|${error.module_id ?? ''}`;

    // Deduplicate
    const existing = this.errors.find(
      e => e.message === error.message
        && e.source === (error.source ?? 'frontend')
        && now - e.last_seen < DEDUP_WINDOW_MS,
    );

    if (existing) {
      existing.count++;
      existing.last_seen = now;
    } else {
      this.errors.push({
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        message: error.message,
        stack: error.stack,
        source: error.source ?? 'frontend',
        severity: error.severity ?? 'medium',
        module_id: error.module_id,
        user_id: error.user_id,
        url: error.url,
        count: 1,
        first_seen: now,
        last_seen: now,
        resolved: false,
        metadata: error.metadata,
      });
    }

    // Trim
    if (this.errors.length > MAX_ERRORS) {
      this.errors.splice(0, this.errors.length - MAX_ERRORS);
    }

    getMetricsCollector().increment('errors_total', {
      source: error.source ?? 'frontend',
      severity: error.severity ?? 'medium',
    });
    this.notify();
  }

  resolve(errorId: string) {
    const err = this.errors.find(e => e.id === errorId);
    if (err) {
      err.resolved = true;
      this.notify();
    }
  }

  getSummary(): ErrorSummary {
    const now = Date.now();
    const hour = now - 3_600_000;
    const day = now - 86_400_000;

    const unresolvedErrors = this.errors.filter(e => !e.resolved);
    const errors1h = unresolvedErrors.filter(e => e.last_seen >= hour);
    const errors24h = unresolvedErrors.filter(e => e.last_seen >= day);

    const bySource: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const err of unresolvedErrors) {
      bySource[err.source] = (bySource[err.source] ?? 0) + err.count;
      bySeverity[err.severity] = (bySeverity[err.severity] ?? 0) + err.count;
    }

    return {
      total_errors_1h: errors1h.reduce((sum, e) => sum + e.count, 0),
      total_errors_24h: errors24h.reduce((sum, e) => sum + e.count, 0),
      error_rate_per_min: errors1h.length > 0 ? Math.round((errors1h.reduce((s, e) => s + e.count, 0) / 60) * 100) / 100 : 0,
      top_errors: unresolvedErrors.sort((a, b) => b.count - a.count).slice(0, 10),
      by_source: bySource,
      by_severity: bySeverity,
    };
  }

  getErrors(opts?: { source?: string; resolved?: boolean }): TrackedError[] {
    let result = this.errors;
    if (opts?.source) result = result.filter(e => e.source === opts.source);
    if (opts?.resolved !== undefined) result = result.filter(e => e.resolved === opts.resolved);
    return result;
  }

  clear() {
    this.errors = [];
    this.notify();
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

let _tracker: ErrorTracker | null = null;
export function getErrorTracker(): ErrorTracker {
  if (!_tracker) _tracker = new ErrorTracker();
  return _tracker;
}

export { ErrorTracker };
