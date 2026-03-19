/**
 * useFleetRealtime — Real-time event streaming hook for fleet compliance.
 *
 * Uses Supabase Realtime (WebSocket) as primary channel with automatic
 * polling fallback + deduplication for:
 * - TrackingEvents (raw_tracking_events)
 * - BehaviorEvents (fleet_behavior_events)
 * - ComplianceIncidents (fleet_compliance_incidents)
 * - WarningIssued / DisciplinaryHistory (fleet_disciplinary_history)
 * - ComplianceViolations (compliance_violations)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ──

export type RealtimeEventType =
  | 'tracking'
  | 'behavior'
  | 'compliance_incident'
  | 'disciplinary'
  | 'violation';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'polling';

const TABLE_MAP: Record<RealtimeEventType, string> = {
  tracking: 'raw_tracking_events',
  behavior: 'fleet_behavior_events',
  compliance_incident: 'fleet_compliance_incidents',
  disciplinary: 'fleet_disciplinary_history',
  violation: 'compliance_violations',
};

interface UseFleetRealtimeOptions {
  /** Which event streams to subscribe to */
  eventTypes: RealtimeEventType[];
  /** Tenant ID filter */
  tenantId: string | null;
  /** Max events to keep per type (default 100) */
  maxEvents?: number;
  /** Enable/disable (default true) */
  enabled?: boolean;
}

interface EventBucket<T = any> {
  items: T[];
  lastUpdate: Date | null;
}

export type EventStore = Record<RealtimeEventType, EventBucket>;

interface UseFleetRealtimeReturn {
  events: EventStore;
  status: ConnectionStatus;
  /** Force refresh all subscribed types */
  refresh: () => void;
}

// ── Deduplication ──

function deduplicateAndSort<T extends { id: string }>(
  current: T[],
  incoming: T | T[],
  max: number,
): T[] {
  const incomingArr = Array.isArray(incoming) ? incoming : [incoming];
  const ids = new Set(incomingArr.map((i) => i.id));
  const filtered = current.filter((item) => !ids.has(item.id));
  return [...incomingArr, ...filtered].slice(0, max);
}

// ── Typed fetch helper to avoid TS2589 with dynamic table names ──

async function fetchTableData(table: string, tenantId: string, limit: number) {
  // Use type assertion to bypass strict table name checking
  const { data, error } = await (supabase.from as any)(table)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(`[useFleetRealtime] fetch ${table} error:`, error);
    return [];
  }
  return data ?? [];
}

// ── Hook ──

export function useFleetRealtime(opts: UseFleetRealtimeOptions): UseFleetRealtimeReturn {
  const { eventTypes, tenantId, maxEvents = 100, enabled = true } = opts;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [events, setEvents] = useState<EventStore>(() => {
    const init: Partial<EventStore> = {};
    for (const t of eventTypes) init[t] = { items: [], lastUpdate: null };
    return init as EventStore;
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pollIntervalRef = useRef(3000);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  // ── Polling fallback ──
  const pollAll = useCallback(async () => {
    if (!tenantId) return;

    for (const evType of eventTypes) {
      const table = TABLE_MAP[evType];
      const data = await fetchTableData(table, tenantId, maxEvents);

      if (data.length > 0) {
        setEvents((prev) => ({
          ...prev,
          [evType]: {
            items: deduplicateAndSort(prev[evType]?.items ?? [], data, maxEvents),
            lastUpdate: new Date(),
          },
        }));
        pollIntervalRef.current = 3000;
      }
    }
  }, [tenantId, eventTypes, maxEvents]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    const tick = async () => {
      await pollAll();
      pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
      pollTimerRef.current = setTimeout(tick, pollIntervalRef.current);
    };

    setStatus('polling');
    pollTimerRef.current = setTimeout(tick, pollIntervalRef.current);
  }, [pollAll]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    if (!enabled || !tenantId) return;

    setStatus('connecting');

    // Initial data fetch
    pollAll();

    const channels: RealtimeChannel[] = [];

    for (const evType of eventTypes) {
      const table = TABLE_MAP[evType];
      const channel = supabase
        .channel(`fleet-rt:${evType}:${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const row = payload.new as any;
            setEvents((prev) => ({
              ...prev,
              [evType]: {
                items: deduplicateAndSort(prev[evType]?.items ?? [], row, maxEvents),
                lastUpdate: new Date(),
              },
            }));
            pollIntervalRef.current = 3000;
          },
        )
        .subscribe((st, err) => {
          if (st === 'SUBSCRIBED') {
            setStatus('connected');
          } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
            console.warn(`[useFleetRealtime] ${evType} channel ${st}`, err);
            startPolling();
          }
        });

      channels.push(channel);
    }

    channelsRef.current = channels;

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [enabled, tenantId, eventTypes.join(','), maxEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    pollIntervalRef.current = 3000;
    pollAll();
  }, [pollAll]);

  return { events, status, refresh };
}
