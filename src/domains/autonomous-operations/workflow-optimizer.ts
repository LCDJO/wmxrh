/**
 * WorkflowOptimizer — Suggests optimizations for cross-module workflows.
 */

import type { WorkflowOptimization } from './types';

let _wfSeq = 0;

interface WorkflowMetrics {
  workflow_name: string;
  module_key: string;
  avg_duration_ms: number;
  p95_duration_ms: number;
  execution_count: number;
  error_rate: number;
  has_sequential_steps: boolean;
  has_redundant_checks: boolean;
  cacheable_steps: number;
}

function suggestOptimizations(metrics: WorkflowMetrics): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];

  if (metrics.has_sequential_steps && metrics.avg_duration_ms > 500) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: metrics.workflow_name,
      module_key: metrics.module_key,
      current_avg_duration_ms: metrics.avg_duration_ms,
      suggested_duration_ms: Math.round(metrics.avg_duration_ms * 0.55),
      optimization_type: 'parallel',
      description: 'Etapas sequenciais podem ser paralelizadas para reduzir latência',
      estimated_speedup_pct: 45,
    });
  }

  if (metrics.cacheable_steps > 0 && metrics.execution_count > 50) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: metrics.workflow_name,
      module_key: metrics.module_key,
      current_avg_duration_ms: metrics.avg_duration_ms,
      suggested_duration_ms: Math.round(metrics.avg_duration_ms * 0.7),
      optimization_type: 'cache',
      description: `${metrics.cacheable_steps} etapa(s) com resultados cacheaveis identificada(s)`,
      estimated_speedup_pct: 30,
    });
  }

  if (metrics.has_redundant_checks) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: metrics.workflow_name,
      module_key: metrics.module_key,
      current_avg_duration_ms: metrics.avg_duration_ms,
      suggested_duration_ms: Math.round(metrics.avg_duration_ms * 0.85),
      optimization_type: 'skip_redundant',
      description: 'Verificações redundantes detectadas que podem ser removidas',
      estimated_speedup_pct: 15,
    });
  }

  return opts;
}

export const WorkflowOptimizer = {
  /** Analyze workflow metrics and suggest optimizations */
  optimize(metricsArr: WorkflowMetrics[]): WorkflowOptimization[] {
    return metricsArr.flatMap(suggestOptimizations);
  },

  /** Generate preview data for dashboard */
  generatePreview(): WorkflowOptimization[] {
    const mockMetrics: WorkflowMetrics[] = [
      { workflow_name: 'Admissão de Colaborador', module_key: 'core_hr', avg_duration_ms: 1200, p95_duration_ms: 2800, execution_count: 120, error_rate: 0.02, has_sequential_steps: true, has_redundant_checks: false, cacheable_steps: 2 },
      { workflow_name: 'Cálculo de Folha', module_key: 'payroll_sim', avg_duration_ms: 3500, p95_duration_ms: 8000, execution_count: 45, error_rate: 0.05, has_sequential_steps: true, has_redundant_checks: true, cacheable_steps: 3 },
      { workflow_name: 'Compliance Check', module_key: 'compliance', avg_duration_ms: 800, p95_duration_ms: 1500, execution_count: 200, error_rate: 0.01, has_sequential_steps: false, has_redundant_checks: true, cacheable_steps: 1 },
    ];
    return WorkflowOptimizer.optimize(mockMetrics);
  },
};
