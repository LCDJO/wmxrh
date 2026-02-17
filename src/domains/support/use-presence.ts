import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type PresenceStatus = 'online' | 'typing' | 'offline';

export interface PresenceState {
  userId: string;
  status: PresenceStatus;
  senderType: 'agent' | 'tenant';
  name?: string;
  lastSeen?: string;
}

interface UsePresenceOptions {
  sessionId: string | null;
  userId: string;
  senderType: 'agent' | 'tenant';
  name?: string;
}

export function usePresence({ sessionId, userId, senderType, name }: UsePresenceOptions) {
  const [peers, setPeers] = useState<PresenceState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStatusRef = useRef<PresenceStatus>('online');

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`presence-chat-${sessionId}`, {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          userId: string;
          status: PresenceStatus;
          senderType: string;
          name?: string;
          lastSeen?: string;
        }>();

        const presences: PresenceState[] = [];
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (entries && entries.length > 0) {
            const latest = entries[entries.length - 1];
            if (latest.userId !== userId) {
              presences.push({
                userId: latest.userId,
                status: latest.status,
                senderType: latest.senderType as 'agent' | 'tenant',
                name: latest.name,
                lastSeen: latest.lastSeen,
              });
            }
          }
        }
        setPeers(presences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            status: 'online' as PresenceStatus,
            senderType,
            name: name ?? '',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, userId, senderType, name]);

  const setTyping = useCallback(() => {
    if (!channelRef.current || currentStatusRef.current === 'typing') return;
    currentStatusRef.current = 'typing';

    channelRef.current.track({
      userId,
      status: 'typing' as PresenceStatus,
      senderType,
      name: name ?? '',
      lastSeen: new Date().toISOString(),
    });

    // Auto-revert to online after 3 seconds of no typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      currentStatusRef.current = 'online';
      channelRef.current?.track({
        userId,
        status: 'online' as PresenceStatus,
        senderType,
        name: name ?? '',
        lastSeen: new Date().toISOString(),
      });
    }, 3000);
  }, [userId, senderType, name]);

  const setOnline = useCallback(() => {
    if (!channelRef.current || currentStatusRef.current === 'online') return;
    currentStatusRef.current = 'online';
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    channelRef.current.track({
      userId,
      status: 'online' as PresenceStatus,
      senderType,
      name: name ?? '',
      lastSeen: new Date().toISOString(),
    });
  }, [userId, senderType, name]);

  // Counterpart presence helpers
  const counterpart = peers.find((p) => p.senderType !== senderType);
  const isCounterpartOnline = !!counterpart && counterpart.status !== 'offline';
  const isCounterpartTyping = counterpart?.status === 'typing';

  return {
    peers,
    counterpart,
    isCounterpartOnline,
    isCounterpartTyping,
    setTyping,
    setOnline,
  };
}
