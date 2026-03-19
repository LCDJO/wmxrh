/**
 * useTrackModuleVisit — Registra a visita de um usuário a um módulo.
 *
 * Chama a Edge Function `track-module-visit` em background.
 * Silencioso: erros não impactam a UX.
 *
 * Uso:
 *   const trackVisit = useTrackModuleVisit();
 *   useEffect(() => { trackVisit('employees'); }, []);
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export function useTrackModuleVisit() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  return useCallback(
    (moduleKey: string) => {
      if (!user || !currentTenant?.id) return;
      // Fire-and-forget — no await, errors silenced
      supabase.functions
        .invoke('track-module-visit', {
          body: { module_key: moduleKey, tenant_id: currentTenant.id },
        })
        .catch(() => {/* silently ignore */});
    },
    [user, currentTenant?.id],
  );
}
