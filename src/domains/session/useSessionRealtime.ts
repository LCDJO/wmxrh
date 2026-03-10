/**
 * useSessionRealtime — Realtime session event system for dashboards.
 * 
 * Subscribes to both `user_sessions` and `user_session_events` tables via
 * Supabase Realtime (postgres_changes). Classifies events as:
 *   - SESSION_STARTED (INSERT on user_sessions)
 *   - SESSION_UPDATED (UPDATE on user_sessions)
 *   - SESSION_ENDED   (UPDATE status → offline/expired OR DELETE)
 * 
 * Provides:
 *   - Auto-invalidation of React Query cache
 *   - Live event feed (last N events with timestamps)
 *   - Connection health status
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══════════════════════════════
// EVENT TYPES
// ═══════════════════════════════

export type SessionRealtimeEventType = 'SESSION_STARTED' | 'SESSION_UPDATED' | 'SESSION_ENDED';

export interface SessionRealtimeEvent {
  id: string;
  type: SessionRealtimeEventType;
  timestamp: Date;
  sessionId: string;
  userId: string;
  status?: string;
  city?: string;
  browser?: string;
  /** Raw payload from Supabase */
  payload: any;
}

export type ChannelStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ═══════════════════════════════
// HOOK
// ═══════════════════════════════

interface UseSessionRealtimeOptions {
  /** Max events to keep in the feed */
  maxEvents?: number;
  /** React Query keys to invalidate on changes */
  queryKeys?: string[][];
  /** Whether the subscription is active */
  enabled?: boolean;
}

export function useSessionRealtime(options: UseSessionRealtimeOptions = {}) {
  const {
    maxEvents = 50,
    queryKeys = [['platform-user-sessions']],
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const [events, setEvents] = useState<SessionRealtimeEvent[]>([]);
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>('connecting');
  const [counters, setCounters] = useState({ started: 0, updated: 0, ended: 0 });
  const eventIdCounter = useRef(0);

  const pushEvent = useCallback((event: Omit<SessionRealtimeEvent, 'id'>) => {
    eventIdCounter.current++;
    const fullEvent: SessionRealtimeEvent = {
      ...event,
      id: `evt-${eventIdCounter.current}-${Date.now()}`,
    };

    setEvents(prev => [fullEvent, ...prev].slice(0, maxEvents));
    setCounters(prev => ({
      ...prev,
      started: prev.started + (event.type === 'SESSION_STARTED' ? 1 : 0),
      updated: prev.updated + (event.type === 'SESSION_UPDATED' ? 1 : 0),
      ended: prev.ended + (event.type === 'SESSION_ENDED' ? 1 : 0),
    }));
  }, [maxEvents]);

  useEffect(() => {
    if (!enabled) return;

    // ── Channel 1: user_sessions table changes ──
    const sessionsChannel = supabase
      .channel('rt-user-sessions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_sessions' },
        (payload) => {
          const row = payload.new as any;
          pushEvent({
            type: 'SESSION_STARTED',
            timestamp: new Date(),
            sessionId: row.id,
            userId: row.user_id,
            status: row.status,
            city: row.city,
            browser: row.browser,
            payload,
          });
          // Invalidate queries
          queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
          logger.info('RT: SESSION_STARTED', { sessionId: row.id, city: row.city });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_sessions' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;

          // Classify: if status changed to offline/expired → SESSION_ENDED
          const isEnding = (row.status === 'offline' || row.status === 'expired') &&
                           old.status !== 'offline' && old.status !== 'expired';

          const eventType: SessionRealtimeEventType = isEnding ? 'SESSION_ENDED' : 'SESSION_UPDATED';

          pushEvent({
            type: eventType,
            timestamp: new Date(),
            sessionId: row.id,
            userId: row.user_id,
            status: row.status,
            city: row.city,
            browser: row.browser,
            payload,
          });

          queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

          if (isEnding) {
            logger.info('RT: SESSION_ENDED', { sessionId: row.id, duration: row.session_duration });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_sessions' },
        (payload) => {
          const row = payload.old as any;
          pushEvent({
            type: 'SESSION_ENDED',
            timestamp: new Date(),
            sessionId: row.id,
            userId: row.user_id,
            payload,
          });
          queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setChannelStatus('connected');
          logger.info('RT: Connected to user_sessions channel');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setChannelStatus('error');
          logger.error('RT: Channel error', { status, error: err });
        } else if (status === 'CLOSED') {
          setChannelStatus('disconnected');
        }
      });

    // ── Channel 2: user_session_events table changes ──
    const eventsChannel = supabase
      .channel('rt-session-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_session_events' },
        (_payload) => {
          // Invalidate event-related queries
          queryClient.invalidateQueries({ queryKey: ['platform-session-events'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [enabled, pushEvent, queryClient, queryKeys]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setCounters({ started: 0, updated: 0, ended: 0 });
  }, []);

  return {
    /** Live event feed (newest first) */
    events,
    /** Connection status */
    channelStatus,
    /** Event counters since mount */
    counters,
    /** Clear the event feed */
    clearEvents,
  };
}
