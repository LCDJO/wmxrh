/**
 * PlatformSignalCollector — Collects and normalizes events from all platform subsystems.
 */

import type { PlatformSignal, SignalSeverity, SignalSource } from './types';

const SIGNAL_BUFFER: PlatformSignal[] = [];
const MAX_BUFFER = 500;
let _seqId = 0;

function createSignal(
  source: SignalSource,
  event_type: string,
  severity: SignalSeverity,
  payload: Record<string, unknown>,
  tenant_id?: string,
  module_key?: string,
): PlatformSignal {
  const signal: PlatformSignal = {
    id: `sig_${++_seqId}_${Date.now()}`,
    source,
    event_type,
    severity,
    payload,
    tenant_id,
    module_key,
    timestamp: new Date().toISOString(),
  };

  SIGNAL_BUFFER.push(signal);
  if (SIGNAL_BUFFER.length > MAX_BUFFER) {
    SIGNAL_BUFFER.splice(0, SIGNAL_BUFFER.length - MAX_BUFFER);
  }

  return signal;
}

export const PlatformSignalCollector = {
  /** Emit a platform signal */
  emit: createSignal,

  /** Get signals within a time window (last N hours) */
  getRecent(hours: number = 24): PlatformSignal[] {
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    return SIGNAL_BUFFER.filter(s => s.timestamp >= cutoff);
  },

  /** Get signals by source */
  getBySource(source: SignalSource): PlatformSignal[] {
    return SIGNAL_BUFFER.filter(s => s.source === source);
  },

  /** Get signals by severity */
  getBySeverity(severity: SignalSeverity): PlatformSignal[] {
    return SIGNAL_BUFFER.filter(s => s.severity === severity);
  },

  /** Get signal count by source (last 24h) */
  getCountBySource(): Record<SignalSource, number> {
    const recent = PlatformSignalCollector.getRecent(24);
    const counts: Record<string, number> = {};
    for (const s of recent) {
      counts[s.source] = (counts[s.source] || 0) + 1;
    }
    return counts as Record<SignalSource, number>;
  },

  /** Clear all buffered signals */
  clear(): void {
    SIGNAL_BUFFER.length = 0;
  },

  /** Total buffered */
  get size(): number {
    return SIGNAL_BUFFER.length;
  },
};
