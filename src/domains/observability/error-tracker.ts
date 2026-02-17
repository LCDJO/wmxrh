/**
 * ErrorTracker — Captures, deduplicates, and aggregates ApplicationErrors.
 *
 * Severity categories: info | warning | error | critical
 * Error types: runtime | network | validation | authorization | integration | timeout | unhandled | unknown
 *
 * Emits canonical events through GlobalEventKernel:
 *  - ApplicationErrorDetected (every error)
 *  - ErrorRateSpike (when rate exceeds threshold)
 */

import type { TrackedError, ErrorSummary, ErrorSeverity, ErrorType } from './types';
import { getMetricsCollector } from './metrics-collector';
import { OBSERVABILITY_KERNEL_EVENTS, type ApplicationErrorDetectedPayload, type ErrorRateSpikePayload } from './observability-events';
import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';

const MAX_ERRORS = 200;
const DEDUP_WINDOW_MS = 60_000;
const ERROR_RATE_SPIKE_THRESHOLD = 5; // errors/min

class ErrorTracker {
  private errors: TrackedError[] = [];
  private listeners = new Set<() => void>();
  private eventKernel: GlobalEventKernelAPI | null = null;

  /** Bind to GlobalEventKernel for emitting canonical events */
  setEventKernel(kernel: GlobalEventKernelAPI) {
    this.eventKernel = kernel;
  }

  /**
   * Capture an ApplicationError.
   *
   * Required: message
   * Optional: all other fields default to safe values.
   */
  capture(error: {
    message: string;
    stack?: string;
    stack_trace?: string;
    source?: TrackedError['source'];
    severity?: ErrorSeverity;
    error_type?: ErrorType;
    module_id?: string;
    user_id?: string;
    tenant_id?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }) {
    const now = Date.now();
    const source = error.source ?? 'frontend';
    const severity = error.severity ?? 'error';
    const error_type = error.error_type ?? 'unknown';
    const stackTrace = error.stack ?? error.stack_trace;

    // Deduplicate within window
    const existing = this.errors.find(
      e =>
        e.message === error.message &&
        e.source === source &&
        e.module_id === error.module_id &&
        now - e.last_seen < DEDUP_WINDOW_MS,
    );

    if (existing) {
      existing.count++;
      existing.last_seen = now;
      // Escalate severity if new occurrence is higher
      if (severityWeight(severity) > severityWeight(existing.severity)) {
        existing.severity = severity;
      }
    } else {
      this.errors.push({
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        message: error.message,
        stack: stackTrace,
        stack_trace: stackTrace,
        source,
        severity,
        error_type,
        module_id: error.module_id,
        user_id: error.user_id,
        tenant_id: error.tenant_id,
        url: error.url,
        count: 1,
        first_seen: now,
        last_seen: now,
        resolved: false,
        metadata: error.metadata,
      });
    }

    // Trim oldest
    if (this.errors.length > MAX_ERRORS) {
      this.errors.splice(0, this.errors.length - MAX_ERRORS);
    }

    getMetricsCollector().increment('errors_total', {
      source,
      severity,
      error_type,
    });

    // Emit canonical ApplicationErrorDetected
    if (this.eventKernel) {
      const tracked = existing ?? this.errors[this.errors.length - 1];
      this.eventKernel.emit<ApplicationErrorDetectedPayload>(
        OBSERVABILITY_KERNEL_EVENTS.ApplicationErrorDetected,
        'ErrorTracker',
        {
          error_id: tracked.id,
          message: tracked.message,
          severity: tracked.severity,
          error_type: tracked.error_type,
          source: tracked.source,
          module_id: tracked.module_id,
          count: tracked.count,
        },
        { priority: severity === 'critical' ? 'critical' : 'normal' },
      );

      // Check for ErrorRateSpike
      const summary = this.getSummary();
      if (summary.error_rate_per_min > ERROR_RATE_SPIKE_THRESHOLD) {
        const topModule = Object.entries(summary.by_module)
          .sort(([, a], [, b]) => b - a)[0];
        this.eventKernel.emit<ErrorRateSpikePayload>(
          OBSERVABILITY_KERNEL_EVENTS.ErrorRateSpike,
          'ErrorTracker',
          {
            rate_per_min: summary.error_rate_per_min,
            threshold_per_min: ERROR_RATE_SPIKE_THRESHOLD,
            top_module: topModule?.[0],
            total_errors_1h: summary.total_errors_1h,
          },
          { priority: 'high' },
        );
      }
    }

    this.notify();
  }

  /** Mark an error as resolved. */
  resolve(errorId: string, resolvedBy?: string) {
    const err = this.errors.find(e => e.id === errorId);
    if (err) {
      err.resolved = true;
      err.resolved_at = Date.now();
      err.resolved_by = resolvedBy;
      this.notify();
    }
  }

  /** Aggregated summary with breakdowns by source, severity, error_type, and module. */
  getSummary(): ErrorSummary {
    const now = Date.now();
    const hour = now - 3_600_000;
    const day = now - 86_400_000;

    const unresolvedErrors = this.errors.filter(e => !e.resolved);
    const errors1h = unresolvedErrors.filter(e => e.last_seen >= hour);
    const errors24h = unresolvedErrors.filter(e => e.last_seen >= day);

    const bySource: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};
    const byModule: Record<string, number> = {};

    for (const err of unresolvedErrors) {
      bySource[err.source] = (bySource[err.source] ?? 0) + err.count;
      bySeverity[err.severity] = (bySeverity[err.severity] ?? 0) + err.count;
      byErrorType[err.error_type] = (byErrorType[err.error_type] ?? 0) + err.count;
      if (err.module_id) {
        byModule[err.module_id] = (byModule[err.module_id] ?? 0) + err.count;
      }
    }

    return {
      total_errors_1h: errors1h.reduce((sum, e) => sum + e.count, 0),
      total_errors_24h: errors24h.reduce((sum, e) => sum + e.count, 0),
      error_rate_per_min:
        errors1h.length > 0
          ? Math.round((errors1h.reduce((s, e) => s + e.count, 0) / 60) * 100) / 100
          : 0,
      top_errors: unresolvedErrors.sort((a, b) => b.count - a.count).slice(0, 10),
      by_source: bySource,
      by_severity: bySeverity,
      by_error_type: byErrorType,
      by_module: byModule,
    };
  }

  /** Query errors with filters. */
  getErrors(opts?: {
    source?: string;
    severity?: ErrorSeverity;
    error_type?: ErrorType;
    module_id?: string;
    tenant_id?: string;
    resolved?: boolean;
  }): TrackedError[] {
    let result = [...this.errors];
    if (opts?.source) result = result.filter(e => e.source === opts.source);
    if (opts?.severity) result = result.filter(e => e.severity === opts.severity);
    if (opts?.error_type) result = result.filter(e => e.error_type === opts.error_type);
    if (opts?.module_id) result = result.filter(e => e.module_id === opts.module_id);
    if (opts?.tenant_id) result = result.filter(e => e.tenant_id === opts.tenant_id);
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

/** Numeric weight for severity comparison / escalation. */
function severityWeight(s: ErrorSeverity): number {
  switch (s) {
    case 'info': return 0;
    case 'warning': return 1;
    case 'error': return 2;
    case 'critical': return 3;
  }
}

let _tracker: ErrorTracker | null = null;
export function getErrorTracker(): ErrorTracker {
  if (!_tracker) _tracker = new ErrorTracker();
  return _tracker;
}

export { ErrorTracker };
