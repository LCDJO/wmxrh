import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { toast } from 'sonner';

export type IntelligenceAction = 'predict' | 'suggest_adjustments' | 'benchmark';

export interface PredictionResult {
  trend_summary: string;
  projected_avg_6m: number;
  risk_level: 'low' | 'medium' | 'high';
  recommendations: Array<{ description: string; priority: string; estimated_impact?: string }>;
  salary_ranges?: Array<{ role: string; min: number; max: number; recommended: number }>;
}

export interface AdjustmentSuggestion {
  employee_name: string;
  current_salary: number;
  suggested_salary: number;
  percentage: number;
  justification: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AdjustmentResult {
  summary: string;
  total_estimated_cost?: number;
  suggestions: AdjustmentSuggestion[];
}

export interface BenchmarkRanking {
  company_name: string;
  avg_salary: number;
  competitiveness_score: number;
  observation: string;
}

export interface BenchmarkResult {
  summary: string;
  rankings: BenchmarkRanking[];
  recommendations: string[];
}

export interface SalaryStats {
  total_employees: number;
  avg_salary: number;
  median_salary: number;
  companies: Array<{
    company_id: string;
    company_name: string;
    employee_count: number;
    avg_salary: number;
    total_cost: number;
  }>;
}

export function useSalaryIntelligence() {
  const { currentTenant } = useTenant();
  const { scope } = useScope();
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [stats, setStats] = useState<SalaryStats | null>(null);

  const runAction = useCallback(async (action: IntelligenceAction) => {
    if (!currentTenant?.id) {
      toast.error('Selecione um tenant primeiro.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('salary-intelligence', {
        body: {
          action,
          tenant_id: currentTenant.id,
          company_id: scope.level === 'company' ? scope.companyId : undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.stats) setStats(data.stats);

      switch (action) {
        case 'predict':
          setPrediction(data.result);
          toast.success('Previsão salarial gerada com sucesso!');
          break;
        case 'suggest_adjustments':
          setAdjustments(data.result);
          toast.success('Sugestões de ajuste geradas!');
          break;
        case 'benchmark':
          setBenchmark(data.result);
          toast.success('Benchmark entre empresas gerado!');
          break;
      }
    } catch (err: unknown) {
      console.error('salary-intelligence error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar análise de IA.');
    } finally {
      setLoading(false);
    }
  }, [currentTenant, scope]);

  return {
    loading,
    prediction,
    adjustments,
    benchmark,
    stats,
    runPrediction: () => runAction('predict'),
    runAdjustments: () => runAction('suggest_adjustments'),
    runBenchmark: () => runAction('benchmark'),
  };
}
