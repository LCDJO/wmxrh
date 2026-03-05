import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_CENTER = { lat: -15.5989, lng: -56.0949 }; // Cuiabá MT

/**
 * Resolves the best initial map center:
 *  1. Average position of tenant's tracked devices (from DB)
 *  2. Browser geolocation
 *  3. Fallback (Cuiabá-MT)
 *
 * NOTE: No module-level cache — always resolves fresh per tenant to avoid
 * stale coordinates from previous sessions.
 */
export function useDefaultMapCenter(tenantId?: string | null) {
  const [center, setCenter] = useState(FALLBACK_CENTER);
  const resolved = useRef(false);

  useEffect(() => {
    resolved.current = false;
    let cancelled = false;

    async function resolve() {
      // Strategy 1: Device positions from DB
      if (tenantId) {
        try {
          const { data } = await supabase
            .from('traccar_device_cache')
            .select('latitude, longitude')
            .eq('tenant_id', tenantId)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .limit(50);

          if (!cancelled && data && data.length > 0) {
            const validDevices = data.filter(
              (d: any) => d.latitude && d.longitude && d.latitude !== 0 && d.longitude !== 0
            );
            if (validDevices.length > 0) {
              const avgLat = validDevices.reduce((s: number, d: any) => s + d.latitude, 0) / validDevices.length;
              const avgLng = validDevices.reduce((s: number, d: any) => s + d.longitude, 0) / validDevices.length;
              setCenter({ lat: avgLat, lng: avgLng });
              resolved.current = true;
              return;
            }
          }
        } catch {
          // fall through
        }
      }

      // Strategy 2: Browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || resolved.current) return;
            setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            resolved.current = true;
          },
          () => { /* keep fallback */ },
          { timeout: 5000, maximumAge: 300000 }
        );
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [tenantId]);

  return center;
}
