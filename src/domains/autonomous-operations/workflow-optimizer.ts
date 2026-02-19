/**
 * WorkflowOptimizer — Deep analysis of workflow execution patterns.
 *
 * Analyzes:
 *  - Execuções lentas (P95 outliers, avg drift)
 *  - Loops (repetitive node executions, circular dependencies)
 *  - Excesso de chamadas API (fan-out, redundant fetches)
 *
 * Suggests:
 *  - Reordenação de nodes (topological optimization)
 *  - Uso de condições (short-circuit, early-exit)
 *  - Parallelization, caching, batching
 */

import type { WorkflowOptimization } from './types';

let _wfSeq = 0;
const now = () => new Date().toISOString();

// ══════════════════════════════════════════════
// Input types
// ══════════════════════════════════════════════

export interface WorkflowMetrics {
  workflow_id?: string;
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

/** Extended metrics for deep analysis */
export interface WorkflowExecutionProfile extends WorkflowMetrics {
  /** Per-node execution stats */
  node_stats?: NodeExecutionStat[];
  /** Total API calls per execution (avg) */
  avg_api_calls_per_execution?: number;
  /** Detected loop count (nodes re-executed within single run) */
  detected_loops?: number;
  /** Max depth of sequential chain */
  max_chain_depth?: number;
  /** Whether workflow has conditional branches */
  has_conditions?: boolean;
  /** Number of nodes */
  total_nodes?: number;
  /** Nodes that could be reordered for better performance */
  reorderable_nodes?: string[];
}

export interface NodeExecutionStat {
  node_id: string;
  node_name: string;
  avg_duration_ms: number;
  execution_count: number;
  /** How many times this node re-executes per workflow run (>1 = loop) */
  avg_executions_per_run: number;
  /** API calls made by this node per execution */
  api_calls: number;
  /** Whether this node depends on previous node output */
  depends_on_previous: boolean;
}

// ══════════════════════════════════════════════
// Analysis: Slow Executions
// ══════════════════════════════════════════════

function analyzeSlowExecutions(profile: WorkflowExecutionProfile): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];
  const { node_stats, p95_duration_ms, avg_duration_ms } = profile;

  // P95 > 3× avg → tail latency problem
  if (p95_duration_ms > avg_duration_ms * 3) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: avg_duration_ms,
      suggested_duration_ms: Math.round(avg_duration_ms * 0.6),
      optimization_type: 'parallel',
      description: `Latência P95 (${p95_duration_ms}ms) é ${(p95_duration_ms / avg_duration_ms).toFixed(1)}× a média. Indica gargalo intermitente — investigar nodes com variância alta e adicionar timeout + fallback.`,
      estimated_speedup_pct: 40,
    });
  }

  // Find bottleneck nodes (>40% of total time)
  if (node_stats && node_stats.length > 0) {
    const totalNodeTime = node_stats.reduce((s, n) => s + n.avg_duration_ms, 0);
    for (const node of node_stats) {
      const pct = (node.avg_duration_ms / Math.max(totalNodeTime, 1)) * 100;
      if (pct > 40 && node.avg_duration_ms > 200) {
        opts.push({
          id: `wfopt_${++_wfSeq}`,
          workflow_name: profile.workflow_name,
          module_key: profile.module_key,
          current_avg_duration_ms: avg_duration_ms,
          suggested_duration_ms: Math.round(avg_duration_ms * 0.65),
          optimization_type: 'reorder',
          description: `Node "${node.node_name}" consome ${pct.toFixed(0)}% do tempo total (${node.avg_duration_ms}ms). Mover para execução paralela ou aplicar cache de resultado.`,
          estimated_speedup_pct: Math.round(pct * 0.6),
        });
      }
    }
  }

  // Sequential steps that could be parallelized
  if (profile.has_sequential_steps && avg_duration_ms > 500) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: avg_duration_ms,
      suggested_duration_ms: Math.round(avg_duration_ms * 0.55),
      optimization_type: 'parallel',
      description: 'Etapas sequenciais independentes detectadas — paralelizar nodes sem dependência direta para reduzir latência total.',
      estimated_speedup_pct: 45,
    });
  }

  return opts;
}

// ══════════════════════════════════════════════
// Analysis: Loop Detection
// ══════════════════════════════════════════════

function analyzeLoops(profile: WorkflowExecutionProfile): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];

  // Explicit loop count from execution profile
  if (profile.detected_loops && profile.detected_loops > 0) {
    const loopPenalty = profile.detected_loops * 15; // each loop adds ~15% overhead
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: profile.avg_duration_ms,
      suggested_duration_ms: Math.round(profile.avg_duration_ms * (1 - loopPenalty / 100)),
      optimization_type: 'skip_redundant',
      description: `${profile.detected_loops} loop(s) detectado(s) no workflow. Nodes re-executando desnecessariamente — adicionar condição de saída (early-exit) ou usar memo/cache entre iterações.`,
      estimated_speedup_pct: Math.min(60, loopPenalty),
    });
  }

  // Per-node loop detection
  if (profile.node_stats) {
    const loopingNodes = profile.node_stats.filter(n => n.avg_executions_per_run > 1.5);
    for (const node of loopingNodes) {
      opts.push({
        id: `wfopt_${++_wfSeq}`,
        workflow_name: profile.workflow_name,
        module_key: profile.module_key,
        current_avg_duration_ms: profile.avg_duration_ms,
        suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.75),
        optimization_type: 'skip_redundant',
        description: `Node "${node.node_name}" executa ${node.avg_executions_per_run.toFixed(1)}× por run. Sugestão: adicionar condição "se já processado, pular" ou converter para batch único.`,
        estimated_speedup_pct: Math.round((node.avg_executions_per_run - 1) * 20),
      });
    }
  }

  return opts;
}

// ══════════════════════════════════════════════
// Analysis: Excessive API Calls
// ══════════════════════════════════════════════

function analyzeApiOveruse(profile: WorkflowExecutionProfile): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];
  const avgCalls = profile.avg_api_calls_per_execution ?? 0;

  // More than 10 API calls per execution → fan-out problem
  if (avgCalls > 10) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: profile.avg_duration_ms,
      suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.5),
      optimization_type: 'batch',
      description: `Média de ${avgCalls} chamadas API por execução. Consolidar em batch requests ou usar dados em cache para reduzir fan-out.`,
      estimated_speedup_pct: Math.min(70, Math.round(avgCalls * 3)),
    });
  }

  // Per-node API call analysis
  if (profile.node_stats) {
    const heavyNodes = profile.node_stats.filter(n => n.api_calls > 3);
    for (const node of heavyNodes) {
      opts.push({
        id: `wfopt_${++_wfSeq}`,
        workflow_name: profile.workflow_name,
        module_key: profile.module_key,
        current_avg_duration_ms: profile.avg_duration_ms,
        suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.7),
        optimization_type: 'cache',
        description: `Node "${node.node_name}" faz ${node.api_calls} chamadas API por execução. Sugestão: batch request, deduplicar chamadas ou cachear respostas estáticas.`,
        estimated_speedup_pct: Math.round(node.api_calls * 8),
      });
    }
  }

  return opts;
}

// ══════════════════════════════════════════════
// Analysis: Node Reordering
// ══════════════════════════════════════════════

function analyzeReordering(profile: WorkflowExecutionProfile): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];

  // Reorderable nodes identified
  if (profile.reorderable_nodes && profile.reorderable_nodes.length >= 2) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: profile.avg_duration_ms,
      suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.7),
      optimization_type: 'reorder',
      description: `${profile.reorderable_nodes.length} nodes podem ser reordenados: [${profile.reorderable_nodes.join(', ')}]. Reordenar por custo crescente (nodes baratos primeiro) para falhar rápido em condições de erro.`,
      estimated_speedup_pct: 30,
    });
  }

  // Suggest adding conditions if workflow has no conditional branches
  if (profile.has_conditions === false && (profile.total_nodes ?? 0) > 3) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: profile.avg_duration_ms,
      suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.65),
      optimization_type: 'reorder',
      description: `Workflow com ${profile.total_nodes} nodes sem ramificações condicionais. Adicionar condições de short-circuit (ex: "se validação falhar, pular processamento") para evitar execução desnecessária.`,
      estimated_speedup_pct: 35,
    });
  }

  // Max chain depth > 5 → suggest breaking into sub-workflows
  if ((profile.max_chain_depth ?? 0) > 5) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: profile.workflow_name,
      module_key: profile.module_key,
      current_avg_duration_ms: profile.avg_duration_ms,
      suggested_duration_ms: Math.round(profile.avg_duration_ms * 0.75),
      optimization_type: 'reorder',
      description: `Cadeia sequencial de ${profile.max_chain_depth} nodes. Dividir em sub-workflows paralelos ou adicionar checkpoints para execução incremental.`,
      estimated_speedup_pct: 25,
    });
  }

  return opts;
}

// ══════════════════════════════════════════════
// Legacy analysis (backward-compatible)
// ══════════════════════════════════════════════

function suggestBasicOptimizations(metrics: WorkflowMetrics): WorkflowOptimization[] {
  const opts: WorkflowOptimization[] = [];

  if (metrics.cacheable_steps > 0 && metrics.execution_count > 50) {
    opts.push({
      id: `wfopt_${++_wfSeq}`,
      workflow_name: metrics.workflow_name,
      module_key: metrics.module_key,
      current_avg_duration_ms: metrics.avg_duration_ms,
      suggested_duration_ms: Math.round(metrics.avg_duration_ms * 0.7),
      optimization_type: 'cache',
      description: `${metrics.cacheable_steps} etapa(s) com resultados cacheáveis identificada(s)`,
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

// ══════════════════════════════════════════════
// Full deep analysis
// ══════════════════════════════════════════════

function deepAnalyze(profile: WorkflowExecutionProfile): WorkflowOptimization[] {
  return [
    ...analyzeSlowExecutions(profile),
    ...analyzeLoops(profile),
    ...analyzeApiOveruse(profile),
    ...analyzeReordering(profile),
    ...suggestBasicOptimizations(profile),
  ];
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

export const WorkflowOptimizer = {
  /** Basic analysis from WorkflowMetrics (backward-compatible) */
  optimize(metricsArr: WorkflowMetrics[]): WorkflowOptimization[] {
    return metricsArr.flatMap(m => {
      const profile: WorkflowExecutionProfile = m;
      return [
        ...analyzeSlowExecutions(profile),
        ...suggestBasicOptimizations(profile),
      ];
    });
  },

  /** Deep analysis with full execution profiles */
  deepOptimize(profiles: WorkflowExecutionProfile[]): WorkflowOptimization[] {
    return profiles.flatMap(deepAnalyze);
  },

  /** Generate preview data for dashboard */
  generatePreview(): WorkflowOptimization[] {
    const profiles: WorkflowExecutionProfile[] = [
      {
        workflow_name: 'Admissão de Colaborador',
        module_key: 'core_hr',
        avg_duration_ms: 1200,
        p95_duration_ms: 4200,
        execution_count: 120,
        error_rate: 0.02,
        has_sequential_steps: true,
        has_redundant_checks: false,
        cacheable_steps: 2,
        avg_api_calls_per_execution: 14,
        detected_loops: 0,
        max_chain_depth: 6,
        has_conditions: false,
        total_nodes: 8,
        reorderable_nodes: ['validar_dados', 'verificar_documentos', 'criar_acesso'],
        node_stats: [
          { node_id: 'n1', node_name: 'Buscar dados eSocial', avg_duration_ms: 450, execution_count: 120, avg_executions_per_run: 1, api_calls: 5, depends_on_previous: false },
          { node_id: 'n2', node_name: 'Validar documentos', avg_duration_ms: 300, execution_count: 120, avg_executions_per_run: 1, api_calls: 2, depends_on_previous: false },
          { node_id: 'n3', node_name: 'Criar perfil', avg_duration_ms: 150, execution_count: 120, avg_executions_per_run: 1, api_calls: 1, depends_on_previous: true },
        ],
      },
      {
        workflow_name: 'Cálculo de Folha',
        module_key: 'payroll_sim',
        avg_duration_ms: 3500,
        p95_duration_ms: 12000,
        execution_count: 45,
        error_rate: 0.05,
        has_sequential_steps: true,
        has_redundant_checks: true,
        cacheable_steps: 3,
        avg_api_calls_per_execution: 22,
        detected_loops: 2,
        max_chain_depth: 9,
        has_conditions: true,
        total_nodes: 12,
        node_stats: [
          { node_id: 'p1', node_name: 'Buscar regras trabalhistas', avg_duration_ms: 800, execution_count: 45, avg_executions_per_run: 2.3, api_calls: 4, depends_on_previous: false },
          { node_id: 'p2', node_name: 'Calcular INSS', avg_duration_ms: 600, execution_count: 45, avg_executions_per_run: 1, api_calls: 1, depends_on_previous: true },
          { node_id: 'p3', node_name: 'Validar benefícios', avg_duration_ms: 500, execution_count: 45, avg_executions_per_run: 1.8, api_calls: 6, depends_on_previous: false },
        ],
      },
      {
        workflow_name: 'Compliance Check',
        module_key: 'compliance',
        avg_duration_ms: 800,
        p95_duration_ms: 1500,
        execution_count: 200,
        error_rate: 0.01,
        has_sequential_steps: false,
        has_redundant_checks: true,
        cacheable_steps: 1,
        avg_api_calls_per_execution: 3,
        detected_loops: 0,
        max_chain_depth: 3,
        has_conditions: false,
        total_nodes: 5,
      },
    ];

    return WorkflowOptimizer.deepOptimize(profiles);
  },
};
