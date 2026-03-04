/**
 * useFleetPipeline — Hook React para executar e consumir o pipeline de frota.
 *
 * Fornece dados processados para todos os dashboards:
 *  - Viagens com velocidade média
 *  - Histórico de trajeto
 *  - Detecção de radar
 *  - Ranking de motoristas
 *  - Heatmap de risco
 *  - Advertências automáticas
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  executePipeline,
  executeLightPipeline,
  type PipelineExecutionResult,
  type PipelineOptions,
} from '../../fleet-intelligence/fleet-data-pipeline';

export interface UseFleetPipelineReturn {
  /** Resultado completo do pipeline */
  result: PipelineExecutionResult | null;
  /** Se está executando */
  loading: boolean;
  /** Erro da última execução */
  error: string | null;
  /** Executa pipeline completo (com sync) */
  runFull: (opts: Omit<PipelineOptions, 'tenantId'>) => Promise<void>;
  /** Executa pipeline leve (sem sync, só análise) */
  runLight: (from: string, to: string) => Promise<void>;
  /** Limpa resultado */
  clear: () => void;
}

export function useFleetPipeline(tenantId: string | null): UseFleetPipelineReturn {
  const [result, setResult] = useState<PipelineExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runFull = useCallback(async (opts: Omit<PipelineOptions, 'tenantId'>) => {
    if (!tenantId) {
      setError('Tenant não identificado');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await executePipeline({ tenantId, ...opts });
      setResult(res);

      // Notificações
      if (res.infractions.infractions_created > 0) {
        toast.warning(`${res.infractions.infractions_created} infração(ões) gerada(s)`);
      }
      if (res.infractions.escalations.length > 0) {
        toast.error(`${res.infractions.escalations.length} escalonamento(s) disciplinar(es) detectado(s)`);
      }
      toast.success(`Pipeline concluído em ${res.durationMs}ms — ${res.tripAnalysis.trips.length} viagens analisadas`);
    } catch (err: any) {
      const msg = err.message || 'Erro ao executar pipeline';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const runLight = useCallback(async (from: string, to: string) => {
    if (!tenantId) {
      setError('Tenant não identificado');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await executeLightPipeline(tenantId, from, to);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao executar análise');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, runFull, runLight, clear };
}
