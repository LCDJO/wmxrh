/**
 * usePlatformCognitive — Hook backed by CognitiveInsightsService orchestrator.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { CognitiveInsightsService } from '@/domains/platform-cognitive/cognitive-insights.service';
import type { CognitiveIntent, CognitiveResponse } from '@/domains/platform-cognitive/types';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';

// Singleton so behaviour tracking persists across mounts
let _service: CognitiveInsightsService | null = null;
function getService() {
  if (!_service) _service = new CognitiveInsightsService();
  return _service;
}

export function usePlatformCognitive() {
  const service = useRef(getService()).current;
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CognitiveResponse | null>(null);
  const { toast } = useToast();
  const location = useLocation();

  // Auto-track navigation
  useEffect(() => {
    service.trackNavigation(location.pathname);
  }, [location.pathname, service]);

  const ask = useCallback(
    async (intent: CognitiveIntent, caller: { role: string; email: string }, params?: Record<string, unknown>) => {
      setLoading(true);
      setResponse(null);
      try {
        const res = await service.query(intent, caller, params);
        setResponse(res);
        return res;
      } catch (e: any) {
        console.error('Cognitive error:', e);
        toast({ title: 'Cognitive Layer', description: e.message ?? 'Falha ao obter sugestões', variant: 'destructive' });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service, toast],
  );

  const clear = useCallback(() => setResponse(null), []);
  const refresh = useCallback(() => service.refreshContext(), [service]);

  return { ask, loading, response, clear, refresh, getBehavior: () => service.getBehaviorProfile() };
}
