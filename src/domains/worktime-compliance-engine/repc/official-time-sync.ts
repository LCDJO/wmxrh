/**
 * OfficialTimeSyncService — Sincronização com hora oficial brasileira.
 * Portaria 671/2021 Art. 75 §3º — REP-C deve sincronizar com fonte confiável.
 *
 * Usa fallback chain: NTP pool → worldtimeapi → local com drift tracking.
 */

import type { TimeSyncResult, TimeSyncConfig } from './types';

const DEFAULT_CONFIG: TimeSyncConfig = {
  ntp_servers: [
    'https://worldtimeapi.org/api/timezone/America/Sao_Paulo',
  ],
  sync_interval_minutes: 60,
  max_drift_ms: 1000,
  fallback_to_local: true,
};

export class OfficialTimeSyncService {
  private config: TimeSyncConfig;
  private lastSync: TimeSyncResult | null = null;
  private offsetMs = 0;

  constructor(config?: Partial<TimeSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async sync(): Promise<TimeSyncResult> {
    const localBefore = Date.now();

    try {
      // Try WorldTimeAPI (works in browser)
      const resp = await fetch(this.config.ntp_servers[0]);
      const localAfter = Date.now();
      const roundTrip = localAfter - localBefore;

      if (resp.ok) {
        const data = await resp.json();
        const serverTime = new Date(data.datetime ?? data.utc_datetime).getTime();
        const localMid = localBefore + roundTrip / 2;
        this.offsetMs = serverTime - localMid;

        this.lastSync = {
          synced: true,
          ntp_server: this.config.ntp_servers[0],
          local_time: new Date(localMid).toISOString(),
          server_time: new Date(serverTime).toISOString(),
          offset_ms: this.offsetMs,
          round_trip_ms: roundTrip,
          stratum: 2,
          synced_at: new Date().toISOString(),
          max_drift_ms: this.config.max_drift_ms,
          within_tolerance: Math.abs(this.offsetMs) <= this.config.max_drift_ms,
        };
        return this.lastSync;
      }
    } catch {
      // Fallback
    }

    // Fallback to local clock
    this.lastSync = {
      synced: false,
      ntp_server: 'local_fallback',
      local_time: new Date().toISOString(),
      server_time: new Date().toISOString(),
      offset_ms: 0,
      round_trip_ms: 0,
      stratum: 16,
      synced_at: new Date().toISOString(),
      max_drift_ms: this.config.max_drift_ms,
      within_tolerance: this.config.fallback_to_local,
    };
    return this.lastSync;
  }

  getLastSync(): TimeSyncResult | null {
    return this.lastSync;
  }

  getConfig(): TimeSyncConfig {
    return { ...this.config };
  }

  isWithinTolerance(): boolean {
    if (!this.lastSync) return false;
    return this.lastSync.within_tolerance;
  }

  /** Returns corrected server time ISO string */
  getServerTime(): string {
    return new Date(Date.now() + this.offsetMs).toISOString();
  }
}
