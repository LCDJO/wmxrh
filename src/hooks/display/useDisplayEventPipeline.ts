/**
 * useDisplayEventPipeline — Enterprise real-time event pipeline hook.
 *
 * Connects to the server-side event queue via:
 *   1. Supabase Realtime (WebSocket) for instant push
 *   2. Polling fallback for reliability
 *   3. Client-side dedup + ordering
 *
 * Flow: display_event_queue (Realtime INSERT) → client buffer → onEvent callback
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDisplayEventQueue, type QueuedEvent } from './useDisplayEventQueue';

export type PipelineStatus = 'disconnected' | 'connecting' | 'realtime' | 'polling' | 'error';

interface PipelineEvent {
  id: string;
  event_type: string;
  source: string;
  channel: string;
  payload: Record<string, unknown>;
  priority: number;
  created_at: string;
}

interface UseDisplayEventPipelineOptions {
  tenantId: string | null;
  channel?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  onEvent?: (events: PipelineEvent[]) => void;
  /** When true, skip Supabase Realtime and use HTTP polling only (e.g. unauthenticated TV context) */
  pollingOnly?: boolean;
}

export function useDisplayEventPipeline({
  tenantId,
  channel,
  enabled = true,
  pollIntervalMs = 10_000,
  onEvent,
  pollingOnly = false,
}: UseDisplayEventPipelineOptions) {
  const [status, setStatus] = useState<PipelineStatus>('disconnected');
  const [eventCount, setEventCount] = useState(0);
  const channelRef = useRef<any>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>();
  const lastEventTimeRef = useRef<string>(new Date().toISOString());
  const seenIdsRef = useRef<Set<string>>(new Set());

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionsBase = `https://${projectId}.supabase.co/functions/v1`;

  // Client-side event queue for dedup + batching
  const { enqueue, enqueueBatch, stats } = useDisplayEventQueue({
    maxBufferSize: 1000,
    flushIntervalMs: 200,
    onFlush: (events) => {
      const pipelineEvents: PipelineEvent[] = events.map((e) => ({
        ...JSON.parse(JSON.stringify(e.payload)),
        id: e.id,
        created_at: e.timestamp,
      }));
      onEvent?.(pipelineEvents);
      setEventCount((c) => c + pipelineEvents.length);
    },
  });

  // Dedup helper
  const processNewEvents = useCallback(
    (events: PipelineEvent[]) => {
      const newEvents = events.filter((e) => {
        if (seenIdsRef.current.has(e.id)) return false;
        seenIdsRef.current.add(e.id);
        // Keep seen set bounded
        if (seenIdsRef.current.size > 5000) {
          const arr = Array.from(seenIdsRef.current);
          seenIdsRef.current = new Set(arr.slice(-2500));
        }
        return true;
      });

      if (newEvents.length === 0) return;

      const queued: QueuedEvent[] = newEvents.map((e) => ({
        id: e.id,
        source: e.source === 'realtime' ? 'realtime' : 'poll',
        timestamp: e.created_at,
        payload: e,
      }));

      enqueueBatch(queued);

      // Update cursor
      const latest = newEvents.reduce(
        (max, e) => (e.created_at > max ? e.created_at : max),
        lastEventTimeRef.current
      );
      lastEventTimeRef.current = latest;
    },
    [enqueueBatch]
  );

  // Poll fallback
  const pollEvents = useCallback(async () => {
    if (!tenantId) return;

    try {
      const params = new URLSearchParams({
        action: 'subscribe',
        tenant_id: tenantId,
        since: lastEventTimeRef.current,
        limit: '100',
      });
      if (channel) params.set('channel', channel);

      const resp = await fetch(`${functionsBase}/display-event-processor?${params}`);
      if (!resp.ok) return;

      const data = await resp.json();
      if (data.events?.length > 0) {
        processNewEvents(data.events);
      }
    } catch {
      // Silent fallback
    }
  }, [tenantId, channel, functionsBase, processNewEvents]);

  useEffect(() => {
    if (!enabled || !tenantId) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const effectiveChannel = channel ?? `tenant-${tenantId}`;

    // 1. Realtime subscription (skip in polling-only mode, e.g. unauthenticated TV)
    if (!pollingOnly) {
      try {
        const realtimeChannel = supabase
          .channel(`display-pipeline-${effectiveChannel}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'display_event_queue',
              filter: `tenant_id=eq.${tenantId}`,
            },
            (payload) => {
              const row = payload.new as any;
              if (row && (!channel || row.channel === channel)) {
                processNewEvents([
                  {
                    id: row.id,
                    event_type: row.event_type,
                    source: 'realtime',
                    channel: row.channel,
                    payload: row.payload,
                    priority: row.priority,
                    created_at: row.created_at,
                  },
                ]);
              }
            }
          )
          .subscribe((subStatus) => {
            if (subStatus === 'SUBSCRIBED') {
              setStatus('realtime');
            } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
              setStatus('polling');
            }
          });

        channelRef.current = realtimeChannel;
      } catch {
        setStatus('polling');
      }
    } else {
      setStatus('polling');
    }

    // 2. Polling fallback (always active)
    pollTimerRef.current = setInterval(pollEvents, pollIntervalMs);
    pollEvents();

    return () => {
      clearInterval(pollTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, tenantId, channel, pollIntervalMs, pollEvents, processNewEvents, pollingOnly]);

  return {
    status,
    eventCount,
    queueStats: stats,
  };
}
