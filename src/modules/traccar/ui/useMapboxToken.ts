/**
 * useMapboxToken — Fetches Mapbox access token from backend.
 * Caches the token for the session lifetime.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedToken: string | null = null;

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [loading, setLoading] = useState(!cachedToken);

  useEffect(() => {
    if (cachedToken) return;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        if (error) throw error;
        const t = (data as { token: string })?.token;
        if (t) {
          cachedToken = t;
          setToken(t);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { token, loading };
}
