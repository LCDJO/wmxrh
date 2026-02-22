/**
 * useFailsafeMode — Detects WebSocket failures and manages fallback state.
 *
 * Features:
 *   ✅ Detects when all realtime channels are down
 *   ✅ Tracks time since last successful data refresh
 *   ✅ Provides failsafe state for UI warning banner
 *   ✅ Auto-clears warning when connection restores
 *   ✅ Configurable staleness threshold
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export type FailsafeLevel = 'ok' | 'degraded' | 'failsafe';

export interface FailsafeState {
  level: FailsafeLevel;
  /** True when operating on polling fallback */
  isPollingFallback: boolean;
  /** Seconds since last successful data update */
  staleSince: number;
  /** Human-readable status message */
  message: string;
  /** Number of consecutive reconnect attempts */
  reconnectAttempts: number;
  /** Timestamp of last successful update */
  lastSuccessAt: Date | null;
}

interface UseFailsafeModeOptions {
  /** Current effective connection status */
  connectionStatus: string;
  /** Last successful data update timestamp */
  lastUpdate: Date | null;
  /** Consider data stale after N seconds without update (default: 120) */
  staleThresholdSeconds?: number;
  /** Consider degraded after N seconds (default: 30) */
  degradedThresholdSeconds?: number;
  /** Whether data is loaded */
  hasData: boolean;
}

export function useFailsafeMode({
  connectionStatus,
  lastUpdate,
  staleThresholdSeconds = 120,
  degradedThresholdSeconds = 30,
  hasData,
}: UseFailsafeModeOptions): FailsafeState {
  const [state, setState] = useState<FailsafeState>({
    level: 'ok',
    isPollingFallback: false,
    staleSince: 0,
    message: '',
    reconnectAttempts: 0,
    lastSuccessAt: null,
  });

  const reconnectCountRef = useRef(0);
  const prevStatusRef = useRef(connectionStatus);

  // Track reconnect attempts
  useEffect(() => {
    if (connectionStatus === 'reconnecting' && prevStatusRef.current !== 'reconnecting') {
      reconnectCountRef.current++;
    }
    if (connectionStatus === 'realtime') {
      reconnectCountRef.current = 0;
    }
    prevStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Update failsafe state every second
  useEffect(() => {
    if (!hasData) return;

    const tick = () => {
      const now = Date.now();
      const elapsed = lastUpdate ? Math.floor((now - lastUpdate.getTime()) / 1000) : 0;
      const isRealtime = connectionStatus === 'realtime';
      const isReconnecting = connectionStatus === 'reconnecting';
      const isPolling = connectionStatus === 'polling';

      let level: FailsafeLevel = 'ok';
      let message = '';

      if (isRealtime && elapsed < degradedThresholdSeconds) {
        level = 'ok';
        message = '';
      } else if (isReconnecting || (isPolling && elapsed < staleThresholdSeconds)) {
        level = 'degraded';
        message = isReconnecting
          ? `Reconectando... (tentativa ${reconnectCountRef.current})`
          : 'Modo polling ativo — latência elevada';
      } else if (elapsed >= staleThresholdSeconds) {
        level = 'failsafe';
        message = `Dados desatualizados há ${elapsed}s — verificando conexão`;
      } else if (!isRealtime) {
        level = 'degraded';
        message = 'Conexão em modo fallback';
      }

      setState({
        level,
        isPollingFallback: !isRealtime,
        staleSince: elapsed,
        message,
        reconnectAttempts: reconnectCountRef.current,
        lastSuccessAt: lastUpdate,
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [connectionStatus, lastUpdate, hasData, staleThresholdSeconds, degradedThresholdSeconds]);

  return state;
}
