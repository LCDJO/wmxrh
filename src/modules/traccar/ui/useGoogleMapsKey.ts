import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedKey: string | null = null;

export function useGoogleMapsKey() {
  const [key, setKey] = useState<string | null>(cachedKey);
  const [loading, setLoading] = useState(!cachedKey);

  useEffect(() => {
    if (cachedKey) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('google-maps-key');
        if (error) throw error;
        const k = (data as { key: string })?.key;
        if (k) {
          cachedKey = k;
          setKey(k);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { key, loading };
}
