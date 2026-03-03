/**
 * Architecture Risk Analyzer Engine
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ArchitectureRiskAnalyzer                                    ║
 * ║   ├── DependencyRiskScanner        ← fan-in/fan-out risks   ║
 * ║   ├── CouplingAnalyzer             ← afferent/efferent      ║
 * ║   ├── CircularDependencyDetector   ← cycle detection (DFS)  ║
 * ║   ├── CriticalModuleIdentifier     ← SLA + centrality       ║
 * ║   ├── ChangeImpactPredictor        ← blast radius analysis  ║
 * ║   ├── RiskScoringEngine            ← weighted composite     ║
 * ║   └── RefactorSuggestionEngine     ← actionable suggestions ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Integrates with:
 *   ArchitectureIntelligenceEngine, DependencyGraph, ObservabilityCore
 */

import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import type { ArchModuleInfo, DependencyEdge } from '@/domains/architecture-intelligence/types';

// ── Risk Levels ──

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

// ── Dependency Risk Score (dedicated per-module output) ──

export interface DependencyRiskScore {
  module_key: string;
  module_label: string;
  domain: 'saas' | 'tenant';
  /** Overall dependency risk 0–100 */
  dependency_risk_score: number;
  risk_level: RiskLevel;
  /** Direct incoming dependencies (modules that depend on this) */
  fan_in: number;
  /** Direct outgoing dependencies (modules this depends on) */
  fan_out: number;
  /** Mandatory incoming dependencies */
  mandatory_fan_in: number;
  /** Mandatory outgoing dependencies */
  mandatory_fan_out: number;
  /** Total direct connections (fan_in + fan_out) */
  total_direct_dependencies: number;
  /** Betweenness centrality proxy 0–1 */
  centrality_index: number;
  /** Whether this is a single point of failure */
  is_single_point_of_failure: boolean;
  /** Whether this has excessive outgoing deps */
  is_fragile: boolean;
  /** Modules that directly depend on this one */
  dependents: string[];
  /** Modules this directly depends on */
  dependencies: string[];
  /** Breakdown factors */
  factors: RiskFactor[];
}

export interface ModuleRiskProfile {
  module_key: string;
  module_label: string;
  domain: 'saas' | 'tenant';
  risk_score: number;         // 0–100
  risk_level: RiskLevel;
  dependency_risk: number;    // 0–100
  coupling_risk: number;      // 0–100
  circular_risk: number;      // 0–100 (100 if in a cycle)
  criticality_score: number;  // 0–100
  change_impact_radius: number; // count of transitively affected modules
  dependency_risk_detail: DependencyRiskScore;
  factors: RiskFactor[];
  suggestions: RefactorSuggestion[];
}

export interface RiskFactor {
  category: 'dependency' | 'coupling' | 'circular' | 'criticality' | 'change_impact';
  severity: RiskLevel;
  description: string;
  metric_value: number;
}

export interface RefactorSuggestion {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_modules: string[];
  effort_estimate: 'small' | 'medium' | 'large';
}

export interface CircularDependencyCycle {
  cycle: string[];        // module keys forming the cycle
  severity: RiskLevel;
}

export interface CouplingMetrics {
  module_key: string;
  afferent_coupling: number;  // Ca — modules that depend on this
  efferent_coupling: number;  // Ce — modules this depends on
  instability: number;        // Ce / (Ca + Ce), 0=stable, 1=unstable
  abstractness: number;       // proxy: event count / total events
}

export interface PlatformRiskSummary {
  overall_score: number;      // 0–100
  overall_level: RiskLevel;
  total_modules: number;
  modules_at_risk: number;    // score >= 50
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  circular_cycles: CircularDependencyCycle[];
  top_risks: ModuleRiskProfile[];
  suggestions: RefactorSuggestion[];
}

// ── Helpers ──

function riskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'none';
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// ── 1. DependencyRiskScanner ──

function computeCentralityIndex(
  moduleKey: string,
  edges: DependencyEdge[],
  totalModules: number,
): number {
  // Betweenness centrality proxy: how many shortest paths pass through this node
  // Simplified: (fan_in * fan_out) / max_possible_connections
  const fanIn = edges.filter(e => e.to === moduleKey).length;
  const fanOut = edges.filter(e => e.from === moduleKey).length;
  const maxConnections = Math.max(1, (totalModules - 1) * (totalModules - 1));
  return Math.min(1, (fanIn * fanOut) / maxConnections);
}

function scanDependencyRisk(
  moduleKey: string,
  mod: ArchModuleInfo,
  edges: DependencyEdge[],
  totalModules: number,
): { detail: DependencyRiskScore; score: number; factors: RiskFactor[]; fanIn: number; fanOut: number } {
  const fanIn = edges.filter(e => e.to === moduleKey).length;
  const fanOut = edges.filter(e => e.from === moduleKey).length;
  const mandatoryIn = edges.filter(e => e.to === moduleKey && e.is_mandatory).length;
  const mandatoryOut = edges.filter(e => e.from === moduleKey && e.is_mandatory).length;
  const dependents = edges.filter(e => e.to === moduleKey).map(e => e.from);
  const dependencies = edges.filter(e => e.from === moduleKey).map(e => e.to);
  const totalDirect = fanIn + fanOut;
  const centralityIndex = computeCentralityIndex(moduleKey, edges, totalModules);

  const factors: RiskFactor[] = [];
  let score = 0;

  // ── Fan-in scoring (single point of failure) ──
  const isSPOF = mandatoryIn >= 3 || fanIn >= 5;
  if (fanIn >= 5) {
    score += 35;
    factors.push({ category: 'dependency', severity: 'critical', description: `Alto fan-in: ${fanIn} módulos dependem deste (ponto único de falha)`, metric_value: fanIn });
  } else if (fanIn >= 3) {
    score += 20;
    factors.push({ category: 'dependency', severity: 'high', description: `Fan-in elevado: ${fanIn} dependentes`, metric_value: fanIn });
  } else if (fanIn >= 1) {
    factors.push({ category: 'dependency', severity: 'low', description: `Fan-in: ${fanIn} dependente(s)`, metric_value: fanIn });
  }

  // ── Fan-out scoring (fragility) ──
  const isFragile = fanOut >= 5;
  if (fanOut >= 5) {
    score += 25;
    factors.push({ category: 'dependency', severity: 'high', description: `Alto fan-out: depende de ${fanOut} módulos (módulo frágil)`, metric_value: fanOut });
  } else if (fanOut >= 3) {
    score += 15;
    factors.push({ category: 'dependency', severity: 'medium', description: `Fan-out moderado: depende de ${fanOut} módulos`, metric_value: fanOut });
  }

  // ── Mandatory dependencies amplify risk ──
  if (mandatoryIn >= 3) {
    score += 15;
    factors.push({ category: 'dependency', severity: 'high', description: `${mandatoryIn} dependências mandatórias de entrada — falha propaga obrigatoriamente`, metric_value: mandatoryIn });
  }
  if (mandatoryOut >= 3) {
    score += 10;
    factors.push({ category: 'dependency', severity: 'medium', description: `${mandatoryOut} dependências mandatórias de saída — startup bloqueado se falhar`, metric_value: mandatoryOut });
  }

  // ── Centrality bonus ──
  if (centralityIndex >= 0.15) {
    score += 15;
    factors.push({ category: 'dependency', severity: 'critical', description: `Centralidade alta (${(centralityIndex * 100).toFixed(1)}%) — módulo é hub central da arquitetura`, metric_value: centralityIndex });
  } else if (centralityIndex >= 0.05) {
    score += 8;
    factors.push({ category: 'dependency', severity: 'medium', description: `Centralidade moderada (${(centralityIndex * 100).toFixed(1)}%)`, metric_value: centralityIndex });
  }

  const finalScore = clamp(score);

  const detail: DependencyRiskScore = {
    module_key: moduleKey,
    module_label: mod.label,
    domain: mod.domain,
    dependency_risk_score: finalScore,
    risk_level: riskLevel(finalScore),
    fan_in: fanIn,
    fan_out: fanOut,
    mandatory_fan_in: mandatoryIn,
    mandatory_fan_out: mandatoryOut,
    total_direct_dependencies: totalDirect,
    centrality_index: centralityIndex,
    is_single_point_of_failure: isSPOF,
    is_fragile: isFragile,
    dependents,
    dependencies,
    factors,
  };

  return { detail, score: finalScore, factors, fanIn, fanOut };
}

// ── 2. CouplingAnalyzer ──

function analyzeCoupling(
  moduleKey: string,
  edges: DependencyEdge[],
  modules: ArchModuleInfo[],
): { metrics: CouplingMetrics; score: number; factors: RiskFactor[] } {
  const ca = edges.filter(e => e.to === moduleKey).length;
  const ce = edges.filter(e => e.from === moduleKey).length;
  const instability = ca + ce > 0 ? ce / (ca + ce) : 0;

  const mod = modules.find(m => m.key === moduleKey);
  const totalEvents = modules.reduce((s, m) => s + m.emits_events.length, 0) || 1;
  const abstractness = (mod?.emits_events.length ?? 0) / totalEvents;

  const factors: RiskFactor[] = [];
  let score = 0;

  // Zone of Pain: high stability (low instability) + low abstractness
  // Zone of Uselessness: high instability + high abstractness
  const distance = Math.abs(instability + abstractness - 1); // distance from main sequence
  if (distance > 0.7) {
    score += 30;
    factors.push({ category: 'coupling', severity: 'high', description: `Distância da main sequence: ${distance.toFixed(2)} (zona de dor/inutilidade)`, metric_value: distance });
  } else if (distance > 0.4) {
    score += 15;
    factors.push({ category: 'coupling', severity: 'medium', description: `Distância da main sequence: ${distance.toFixed(2)}`, metric_value: distance });
  }

  if (instability > 0.8 && ce >= 3) {
    score += 20;
    factors.push({ category: 'coupling', severity: 'high', description: `Instabilidade alta (${instability.toFixed(2)}): muito dependente de outros`, metric_value: instability });
  }

  return {
    metrics: { module_key: moduleKey, afferent_coupling: ca, efferent_coupling: ce, instability, abstractness },
    score: clamp(score),
    factors,
  };
}

// ── 3. CircularDependencyDetector (DFS) ──

function detectCircularDependencies(edges: DependencyEdge[]): CircularDependencyCycle[] {
  const graph = new Map<string, string[]>();
  for (const e of edges) {
    if (!graph.has(e.from)) graph.set(e.from, []);
    graph.get(e.from)!.push(e.to);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      dfs(neighbor);
    }

    path.pop();
    stack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  // Deduplicate cycles
  const seen = new Set<string>();
  return cycles
    .map(c => {
      const sorted = [...c].sort().join('→');
      if (seen.has(sorted)) return null;
      seen.add(sorted);
      return {
        cycle: c,
        severity: c.length >= 4 ? 'critical' as RiskLevel : c.length >= 3 ? 'high' as RiskLevel : 'medium' as RiskLevel,
      };
    })
    .filter(Boolean) as CircularDependencyCycle[];
}

// ── 4. CriticalModuleIdentifier ──

function identifyCriticality(
  mod: ArchModuleInfo,
  fanIn: number,
): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // SLA tier
  if (mod.sla.tier === 'critical') {
    score += 40;
    factors.push({ category: 'criticality', severity: 'critical', description: `SLA tier: critical (${mod.sla.uptime_target})`, metric_value: 40 });
  } else if (mod.sla.tier === 'high') {
    score += 25;
    factors.push({ category: 'criticality', severity: 'high', description: `SLA tier: high (${mod.sla.uptime_target})`, metric_value: 25 });
  }

  // Betweenness centrality proxy (high fan-in → central)
  if (fanIn >= 4) {
    score += 20;
    factors.push({ category: 'criticality', severity: 'high', description: `Centralidade alta: ${fanIn} módulos dependem`, metric_value: fanIn });
  }

  // Platform/SaaS core modules carry more risk
  if (mod.domain === 'saas') {
    score += 10;
    factors.push({ category: 'criticality', severity: 'medium', description: 'Módulo da camada SaaS Core (impacto global)', metric_value: 10 });
  }

  return { score: clamp(score), factors };
}

// ── 5. ChangeImpactPredictor ──

function predictChangeImpact(
  moduleKey: string,
  edges: DependencyEdge[],
): { radius: number; affected: string[]; score: number; factors: RiskFactor[] } {
  // BFS to find all transitively affected modules
  const graph = new Map<string, string[]>();
  for (const e of edges) {
    if (!graph.has(e.to)) graph.set(e.to, []);
    graph.get(e.to)!.push(e.from); // reverse: who depends on me
  }

  const affected = new Set<string>();
  const queue = [moduleKey];
  while (queue.length) {
    const current = queue.shift()!;
    for (const dep of graph.get(current) ?? []) {
      if (!affected.has(dep) && dep !== moduleKey) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }

  const radius = affected.size;
  const factors: RiskFactor[] = [];
  let score = 0;

  if (radius >= 8) {
    score = 90;
    factors.push({ category: 'change_impact', severity: 'critical', description: `Blast radius: ${radius} módulos afetados transitivamente`, metric_value: radius });
  } else if (radius >= 5) {
    score = 60;
    factors.push({ category: 'change_impact', severity: 'high', description: `Blast radius: ${radius} módulos afetados`, metric_value: radius });
  } else if (radius >= 3) {
    score = 35;
    factors.push({ category: 'change_impact', severity: 'medium', description: `Blast radius: ${radius} módulos afetados`, metric_value: radius });
  } else if (radius >= 1) {
    score = 15;
    factors.push({ category: 'change_impact', severity: 'low', description: `Blast radius: ${radius} módulo(s) afetado(s)`, metric_value: radius });
  }

  return { radius, affected: Array.from(affected), score: clamp(score), factors };
}

// ── 6. RiskScoringEngine ──

const WEIGHTS = {
  dependency: 0.25,
  coupling: 0.15,
  circular: 0.20,
  criticality: 0.20,
  change_impact: 0.20,
};

function computeCompositeScore(
  depScore: number,
  couplingScore: number,
  circularScore: number,
  criticalityScore: number,
  changeImpactScore: number,
): number {
  return clamp(Math.round(
    depScore * WEIGHTS.dependency +
    couplingScore * WEIGHTS.coupling +
    circularScore * WEIGHTS.circular +
    criticalityScore * WEIGHTS.criticality +
    changeImpactScore * WEIGHTS.change_impact
  ));
}

// ── 7. RefactorSuggestionEngine ──

function generateSuggestions(profile: Omit<ModuleRiskProfile, 'suggestions'>): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const mk = profile.module_key;

  if (profile.circular_risk > 0) {
    suggestions.push({
      id: `refactor-circular-${mk}`,
      priority: 'critical',
      title: `Eliminar dependência circular em ${profile.module_label}`,
      description: 'Introduzir uma interface/contrato de eventos para quebrar o ciclo. Considere Dependency Inversion Principle ou mediator pattern.',
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  if (profile.dependency_risk >= 60) {
    suggestions.push({
      id: `refactor-fanin-${mk}`,
      priority: 'high',
      title: `Reduzir fan-in de ${profile.module_label}`,
      description: 'Extrair interfaces estáveis (abstrações) para reduzir acoplamento direto. Módulos devem depender de contratos, não de implementações.',
      affected_modules: [mk],
      effort_estimate: 'medium',
    });
  }

  if (profile.coupling_risk >= 50) {
    suggestions.push({
      id: `refactor-coupling-${mk}`,
      priority: 'high',
      title: `Melhorar estabilidade de ${profile.module_label}`,
      description: 'Módulo está na zona de dor (alta estabilidade + baixa abstração) ou zona de inutilidade. Reestruturar para aproximar da main sequence.',
      affected_modules: [mk],
      effort_estimate: 'medium',
    });
  }

  if (profile.change_impact_radius >= 5) {
    suggestions.push({
      id: `refactor-blast-${mk}`,
      priority: 'high',
      title: `Reduzir blast radius de ${profile.module_label}`,
      description: `Mudanças impactam ${profile.change_impact_radius} módulos. Considere versionamento semântico estrito e contratos de interface para limitar propagação.`,
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  if (profile.criticality_score >= 60 && profile.dependency_risk >= 40) {
    suggestions.push({
      id: `refactor-resilience-${mk}`,
      priority: 'critical',
      title: `Aumentar resiliência de ${profile.module_label}`,
      description: 'Módulo crítico com alta exposição a dependências. Implementar circuit breakers, fallbacks e degradação graceful.',
      affected_modules: [mk],
      effort_estimate: 'medium',
    });
  }

  return suggestions;
}

// ── Main Engine ──

export interface ArchitectureRiskAnalyzerAPI {
  analyze(): PlatformRiskSummary;
  getModuleRisk(moduleKey: string): ModuleRiskProfile | null;
  getAllProfiles(): ModuleRiskProfile[];
  getCouplingMetrics(): CouplingMetrics[];
  getCircularDependencies(): CircularDependencyCycle[];
  /** Dedicated dependency risk scores for all modules */
  getDependencyRiskScores(): DependencyRiskScore[];
}

export function createArchitectureRiskAnalyzer(): ArchitectureRiskAnalyzerAPI {
  const engine = createArchitectureIntelligenceEngine();
  const modules = engine.getModules();
  const edges = engine.getDependencyEdges();
  const totalModules = modules.length;

  // Pre-compute circular dependencies
  const cycles = detectCircularDependencies(edges);
  const modulesInCycles = new Set<string>();
  for (const c of cycles) {
    for (const k of c.cycle) modulesInCycles.add(k);
  }

  // Build all profiles
  const profiles: ModuleRiskProfile[] = modules.map(mod => {
    const dep = scanDependencyRisk(mod.key, mod, edges, totalModules);
    const coup = analyzeCoupling(mod.key, edges, modules);
    const circularScore = modulesInCycles.has(mod.key) ? 100 : 0;
    const crit = identifyCriticality(mod, dep.fanIn);
    const impact = predictChangeImpact(mod.key, edges);

    const compositeScore = computeCompositeScore(
      dep.score, coup.score, circularScore, crit.score, impact.score,
    );

    const allFactors = [
      ...dep.factors,
      ...coup.factors,
      ...(circularScore > 0 ? [{
        category: 'circular' as const,
        severity: 'critical' as RiskLevel,
        description: 'Módulo participa de dependência circular',
        metric_value: 100,
      }] : []),
      ...crit.factors,
      ...impact.factors,
    ];

    const profileBase: ModuleRiskProfile = {
      module_key: mod.key,
      module_label: mod.label,
      domain: mod.domain,
      risk_score: compositeScore,
      risk_level: riskLevel(compositeScore),
      dependency_risk: dep.score,
      coupling_risk: coup.score,
      circular_risk: circularScore,
      criticality_score: crit.score,
      change_impact_radius: impact.radius,
      dependency_risk_detail: dep.detail,
      factors: allFactors,
      suggestions: [] as RefactorSuggestion[],
    };

    profileBase.suggestions = generateSuggestions(profileBase);

    return profileBase;
  });

  // Sort by risk descending
  profiles.sort((a, b) => b.risk_score - a.risk_score);

  // Coupling metrics
  const couplingMetrics = modules.map(mod => analyzeCoupling(mod.key, edges, modules).metrics);

  // Dependency risk scores (sorted by score desc)
  const depScores = profiles
    .map(p => p.dependency_risk_detail)
    .sort((a, b) => b.dependency_risk_score - a.dependency_risk_score);

  // Aggregate suggestions
  const allSuggestions = profiles.flatMap(p => p.suggestions);
  const uniqueSuggestions = Array.from(new Map(allSuggestions.map(s => [s.id, s])).values());
  uniqueSuggestions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const criticalCount = profiles.filter(p => p.risk_level === 'critical').length;
  const highCount = profiles.filter(p => p.risk_level === 'high').length;
  const mediumCount = profiles.filter(p => p.risk_level === 'medium').length;
  const lowCount = profiles.filter(p => p.risk_level === 'low').length;
  const atRisk = profiles.filter(p => p.risk_score >= 50).length;

  const overallScore = profiles.length
    ? Math.round(profiles.reduce((s, p) => s + p.risk_score, 0) / profiles.length)
    : 0;

  const summary: PlatformRiskSummary = {
    overall_score: overallScore,
    overall_level: riskLevel(overallScore),
    total_modules: modules.length,
    modules_at_risk: atRisk,
    critical_count: criticalCount,
    high_count: highCount,
    medium_count: mediumCount,
    low_count: lowCount,
    circular_cycles: cycles,
    top_risks: profiles.slice(0, 10),
    suggestions: uniqueSuggestions,
  };

  return {
    analyze: () => summary,
    getModuleRisk: (key) => profiles.find(p => p.module_key === key) ?? null,
    getAllProfiles: () => profiles,
    getCouplingMetrics: () => couplingMetrics,
    getCircularDependencies: () => cycles,
    getDependencyRiskScores: () => depScores,
  };
}