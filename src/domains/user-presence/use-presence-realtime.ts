/**
 * usePresenceRealtime — Subscribes to user_sessions realtime changes
 * and triggers refetch on INSERT/UPDATE/DELETE.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePresenceRealtime(onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('user-presence-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions' },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange]);
}
