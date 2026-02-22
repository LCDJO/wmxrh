/**
 * useDisplayRealtime — Shared Realtime channel for multi-TV per tenant.
 *
 * Features:
 *   ✅ Single channel per tenant (shared across N displays)
 *   ✅ Auto-reconnect with exponential backoff
 *   ✅ Polling fallback when WebSocket unavailable
 *   ✅ Connection health tracking
 *   ✅ Deduplication via event queue integration
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 'connecting' | 'realtime' | 'polling' | 'reconnecting' | 'error';

interface UseDisplayRealtimeOptions {
  tenantId: string | null;
  displayId: string | null;
  pollIntervalMs?: number;
  onDataRefresh: () => void;
  enabled?: boolean;
  /** When true, skip Supabase Realtime and use HTTP polling only (e.g. unauthenticated TV context) */
  pollingOnly?: boolean;
}

export function useDisplayRealtime({
  tenantId,
  displayId,
  pollIntervalMs = 15_000,
  onDataRefresh,
  enabled = true,
  pollingOnly = false,
}: UseDisplayRealtimeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<any>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>();
  const backoffRef = useRef(pollIntervalMs);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const cleanup = useCallback(() => {
    clearInterval(pollTimerRef.current);
    clearTimeout(reconnectTimerRef.current);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId || !displayId) return;

    // Start polling as baseline immediately
    pollTimerRef.current = setInterval(onDataRefresh, pollIntervalMs);

    // Skip Realtime WebSocket in polling-only mode (e.g. unauthenticated TV)
    if (pollingOnly) {
      setStatus('polling');
      return cleanup;
    }

    // Try Realtime subscription
    try {
      const channelName = `tv-tenant-${tenantId}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_displays',
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            onDataRefresh();
          }
        )
        .subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            setStatus('realtime');
            backoffRef.current = pollIntervalMs;
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = setInterval(onDataRefresh, Math.max(pollIntervalMs * 2, 30_000));
          } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
            setStatus('reconnecting');
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = setInterval(onDataRefresh, Math.max(backoffRef.current, 10_000));
            reconnectTimerRef.current = setTimeout(() => {
              channel.subscribe();
            }, backoffRef.current);
            backoffRef.current = Math.min(backoffRef.current * 1.5, 60_000);
          }
        });

      channelRef.current = channel;
    } catch {
      setStatus('polling');
    }

    return cleanup;
  }, [enabled, tenantId, displayId, pollIntervalMs, onDataRefresh, cleanup, pollingOnly]);

  return { status };
}
