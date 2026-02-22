/**
 * useDisplayGateway — WebSocket Gateway client hook.
 *
 * Connects to display-ws-gateway with token validation,
 * tenant-scoped channel binding, and auto-reconnect.
 *
 * Flow:
 *   1. Validate token via gateway (HTTP)
 *   2. Connect and receive Realtime subscription config
 *   3. Subscribe to tenant channel via Supabase Realtime
 *   4. Periodic heartbeat to keep session alive
 *   5. Auto-reconnect on disconnect/expiry
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GatewayStatus =
  | 'disconnected'
  | 'validating'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'expired'
  | 'error';

export interface GatewaySession {
  sessionId: string | null;
  tenantId: string;
  displayId: string;
  displayName: string;
  displayType: string;
  channel: string;
  expiresAt: string;
  ttlSeconds: number;
}

interface GatewayEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  priority: number;
  created_at: string;
  _source?: string;
}

interface UseDisplayGatewayOptions {
  token: string | null;
  enabled?: boolean;
  heartbeatIntervalMs?: number;
  pollIntervalMs?: number;
  onEvent?: (events: GatewayEvent[]) => void;
  onSessionExpired?: () => void;
}

export function useDisplayGateway({
  token,
  enabled = true,
  heartbeatIntervalMs = 30_000,
  pollIntervalMs = 10_000,
  onEvent,
  onSessionExpired,
}: UseDisplayGatewayOptions) {
  const [status, setStatus] = useState<GatewayStatus>('disconnected');
  const [session, setSession] = useState<GatewaySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const lastEventTimeRef = useRef<string>(new Date().toISOString());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const backoffRef = useRef(5_000);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const base = `https://${projectId}.supabase.co/functions/v1/display-ws-gateway`;

  // ── Gateway API call ──
  const gatewayCall = useCallback(
    async (action: string, method: string, params?: Record<string, string>) => {
      const searchParams = new URLSearchParams({ action, token: token ?? '', ...params });
      const resp = await fetch(`${base}?${searchParams}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401 && data.action === 'reconnect') {
          setStatus('expired');
          onSessionExpired?.();
        }
        throw new Error(data.error ?? 'Gateway error');
      }
      return data;
    },
    [token, base, onSessionExpired]
  );

  // ── Poll events through gateway ──
  const pollEvents = useCallback(async () => {
    if (!token || !session) return;
    try {
      const params: Record<string, string> = {
        since: lastEventTimeRef.current,
        limit: '100',
      };
      const data = await gatewayCall('events', 'GET', params);
      if (data.events?.length > 0) {
        onEvent?.(data.events);
        setEventCount((c) => c + data.events.length);
        const latest = data.events.reduce(
          (max: string, e: any) => (e.created_at > max ? e.created_at : max),
          lastEventTimeRef.current
        );
        lastEventTimeRef.current = latest;
      }
    } catch {
      // Silent — heartbeat will catch expired sessions
    }
  }, [token, session, gatewayCall, onEvent]);

  // ── Connect to gateway ──
  const connect = useCallback(async () => {
    if (!token) return;

    setStatus('validating');
    setError(null);

    try {
      // Step 1: Connect via gateway (validates token + creates session)
      const result = await gatewayCall('connect', 'POST');

      if (result.type !== 'connected') {
        throw new Error('Unexpected gateway response');
      }

      const gatewaySession: GatewaySession = {
        sessionId: result.session_id,
        tenantId: result.tenant_id,
        displayId: result.display.id,
        displayName: result.display.name,
        displayType: result.display.type,
        channel: result.channel,
        expiresAt: result.expires_at,
        ttlSeconds: Math.floor(
          (new Date(result.expires_at).getTime() - Date.now()) / 1000
        ),
      };

      setSession(gatewaySession);
      setStatus('connecting');
      backoffRef.current = 5_000;

      // Step 2: Process initial pending events
      if (result.pending_events?.length > 0) {
        onEvent?.(result.pending_events);
        setEventCount((c) => c + result.pending_events.length);
      }

      // Step 3: Subscribe to Realtime channel (tenant-scoped)
      const sub = result.subscription;
      if (sub) {
        try {
          const realtimeChannel = supabase
            .channel(sub.realtime_channel)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: sub.realtime_table,
                filter: sub.realtime_filter,
              },
              (payload) => {
                const row = payload.new as any;
                if (row) {
                  const event: GatewayEvent = {
                    id: row.id,
                    event_type: row.event_type,
                    payload: row.payload,
                    priority: row.priority,
                    created_at: row.created_at,
                    _source: 'realtime',
                  };
                  onEvent?.([event]);
                  setEventCount((c) => c + 1);
                  lastEventTimeRef.current = row.created_at;
                }
              }
            )
            // Also subscribe to topic events
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: sub.event_topic_table,
                filter: sub.event_topic_filter,
              },
              (payload) => {
                const row = payload.new as any;
                if (row) {
                  const event: GatewayEvent = {
                    id: row.id,
                    event_type: row.event_type,
                    payload: row.payload,
                    priority: row.priority,
                    created_at: row.created_at,
                    _source: 'event_log',
                  };
                  onEvent?.([event]);
                  setEventCount((c) => c + 1);
                }
              }
            )
            .subscribe((subStatus) => {
              if (subStatus === 'SUBSCRIBED') {
                setStatus('connected');
              } else if (
                subStatus === 'CLOSED' ||
                subStatus === 'CHANNEL_ERROR'
              ) {
                setStatus('reconnecting');
                scheduleReconnect();
              }
            });

          channelRef.current = realtimeChannel;
        } catch {
          setStatus('connected'); // Connected via polling even if realtime fails
        }
      } else {
        setStatus('connected');
      }

      // Step 4: Start heartbeat
      heartbeatRef.current = setInterval(async () => {
        try {
          const hb = await gatewayCall('heartbeat', 'POST');
          if (hb.ttl_seconds < 60) {
            // Token expiring soon
            setSession((prev) =>
              prev ? { ...prev, ttlSeconds: hb.ttl_seconds } : prev
            );
          }
        } catch {
          setStatus('reconnecting');
          scheduleReconnect();
        }
      }, heartbeatIntervalMs);

      // Step 5: Start polling fallback
      pollRef.current = setInterval(pollEvents, pollIntervalMs);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      scheduleReconnect();
    }
  }, [
    token,
    gatewayCall,
    onEvent,
    heartbeatIntervalMs,
    pollIntervalMs,
    pollEvents,
  ]);

  // ── Reconnect with backoff ──
  const scheduleReconnect = useCallback(() => {
    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, backoffRef.current);
    backoffRef.current = Math.min(backoffRef.current * 1.5, 60_000);
  }, [connect]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    clearInterval(heartbeatRef.current);
    clearInterval(pollRef.current);
    clearTimeout(reconnectTimerRef.current);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ── Disconnect gracefully ──
  const disconnect = useCallback(async () => {
    cleanup();
    if (token) {
      try {
        await gatewayCall('disconnect', 'POST');
      } catch { /* best effort */ }
    }
    setStatus('disconnected');
    setSession(null);
  }, [token, gatewayCall, cleanup]);

  // ── Main effect ──
  useEffect(() => {
    if (!enabled || !token) {
      setStatus('disconnected');
      return;
    }
    connect();
    return () => {
      cleanup();
    };
  }, [enabled, token, connect, cleanup]);

  return {
    status,
    session,
    error,
    eventCount,
    disconnect,
    reconnect: connect,
  };
}
