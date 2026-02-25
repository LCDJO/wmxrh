import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, string>();

export function useGoogleMapsKey(tenantId: string | null) {
  const [key, setKey] = useState<string | null>(tenantId ? cache.get(tenantId) ?? null : null);
  const [loading, setLoading] = useState(!key);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    if (cache.has(tenantId)) { setKey(cache.get(tenantId)!); setLoading(false); return; }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('google-maps-key', {
          body: { tenantId },
        });
        if (error) throw error;
        const k = (data as { key: string })?.key;
        if (k) {
          cache.set(tenantId, k);
          setKey(k);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  return { key, loading };
}
