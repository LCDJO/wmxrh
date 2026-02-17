/**
 * LogStreamAdapter — In-memory structured log buffer with filtering.
 *
 * Captures console logs, module events, and custom entries
 * into a queryable ring buffer. Provides stream-like access
 * for real-time log viewing in the observability dashboard.
 */

import { getMetricsCollector } from './metrics-collector';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogSource = 'frontend' | 'module' | 'security' | 'platform' | 'edge_function';

export interface LogEntry {
  id: string;
  level: LogLevel;
  source: LogSource;
  module_id?: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const MAX_ENTRIES = 500;
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

class LogStreamAdapter {
  private entries: LogEntry[] = [];
  private listeners = new Set<(entry: LogEntry) => void>();
  private minLevel: LogLevel = 'info';

  /** Set minimum level for capture (default: info). */
  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  /** Push a log entry into the stream. */
  push(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[this.minLevel]) return;

    const logEntry: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    this.entries.push(logEntry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }

    getMetricsCollector().increment('logs_total', {
      level: entry.level,
      source: entry.source,
    });

    for (const listener of this.listeners) {
      try { listener(logEntry); } catch { /* swallow */ }
    }
  }

  /** Convenience methods. */
  debug(source: LogSource, message: string, meta?: Record<string, unknown>) {
    this.push({ level: 'debug', source, message, metadata: meta });
  }
  info(source: LogSource, message: string, meta?: Record<string, unknown>) {
    this.push({ level: 'info', source, message, metadata: meta });
  }
  warn(source: LogSource, message: string, meta?: Record<string, unknown>) {
    this.push({ level: 'warn', source, message, metadata: meta });
  }
  error(source: LogSource, message: string, meta?: Record<string, unknown>) {
    this.push({ level: 'error', source, message, metadata: meta });
  }
  fatal(source: LogSource, message: string, meta?: Record<string, unknown>) {
    this.push({ level: 'fatal', source, message, metadata: meta });
  }

  /** Query logs with filters. */
  query(opts?: {
    level?: LogLevel;
    source?: LogSource;
    module_id?: string;
    since?: number;
    limit?: number;
    search?: string;
  }): LogEntry[] {
    let result = [...this.entries];
    if (opts?.level) {
      const minP = LEVEL_PRIORITY[opts.level];
      result = result.filter(e => LEVEL_PRIORITY[e.level] >= minP);
    }
    if (opts?.source) result = result.filter(e => e.source === opts.source);
    if (opts?.module_id) result = result.filter(e => e.module_id === opts.module_id);
    if (opts?.since) result = result.filter(e => e.timestamp >= opts.since);
    if (opts?.search) {
      const q = opts.search.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(q));
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  /** Get stats for the last window. */
  getStats(windowMs = 3_600_000) {
    const since = Date.now() - windowMs;
    const recent = this.entries.filter(e => e.timestamp >= since);
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const e of recent) {
      byLevel[e.level] = (byLevel[e.level] ?? 0) + 1;
      bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    }
    return { total: recent.length, byLevel, bySource };
  }

  /** Subscribe to new entries in real time. */
  onEntry(fn: (entry: LogEntry) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Flush buffer (returns flushed entries). */
  flush(): LogEntry[] {
    const flushed = [...this.entries];
    this.entries = [];
    return flushed;
  }

  clear() {
    this.entries = [];
  }
}

let _adapter: LogStreamAdapter | null = null;
export function getLogStreamAdapter(): LogStreamAdapter {
  if (!_adapter) _adapter = new LogStreamAdapter();
  return _adapter;
}

export { LogStreamAdapter };
