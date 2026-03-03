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

// ── Criticality Index (dedicated per-module output) ──

export interface CriticalityIndex {
  module_key: string;
  module_label: string;
  domain: 'saas' | 'tenant';
  /** Overall criticality 0–100 */
  criticality_index: number;
  risk_level: RiskLevel;
  /** SLA contribution 0–40 */
  sla_score: number;
  sla_tier: string;
  /** Dependency centrality contribution 0–25 */
  centrality_score: number;
  fan_in: number;
  /** Incident history contribution 0–20 */
  incident_score: number;
  incident_count_30d: number;
  sev1_count: number;
  sev2_count: number;
  has_recent_critical_incident: boolean;
  /** Usage/domain contribution 0–15 */
  usage_score: number;
  is_saas_core: boolean;
  /** Number of events emitted (proxy for integration surface) */
  event_surface: number;
  /** Transitive dependents count */
  transitive_dependents: number;
  /** Factors breakdown */
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
  criticality_detail: CriticalityIndex;
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
  cycle: string[];            // module keys forming the cycle
  cycle_labels: string[];     // human-readable labels
  severity: RiskLevel;
  /** Number of modules in the cycle (excluding repeated start node) */
  depth: number;
  /** Whether any edge in the cycle is mandatory */
  has_mandatory_edge: boolean;
  /** Whether this cycle crosses SaaS↔Tenant boundary */
  is_cross_domain: boolean;
  /** Domains involved */
  domains_involved: ('saas' | 'tenant')[];
  /** Whether this cycle should block architectural changes */
  is_blocking: boolean;
  /** Reason why this cycle is blocking (or not) */
  blocking_reason: string;
}

export interface BidirectionalDependency {
  module_a: string;
  module_b: string;
  a_to_b_mandatory: boolean;
  b_to_a_mandatory: boolean;
}

export interface CrossDomainViolation {
  from_module: string;
  from_domain: 'saas' | 'tenant';
  to_module: string;
  to_domain: 'saas' | 'tenant';
  is_mandatory: boolean;
  direction: 'saas→tenant' | 'tenant→saas';
  violation_type: 'mutation' | 'direct_dependency';
  description: string;
}

// ── Change Impact Prediction (full) ──

export interface ChangeImpactPrediction {
  module_key: string;
  module_label: string;
  domain: 'saas' | 'tenant';
  /** Transitively impacted modules */
  impacted_modules: ImpactedModule[];
  /** Tenants affected (simulated based on module domain) */
  affected_tenants: AffectedTenant[];
  /** Workflows that depend on this module */
  affected_workflows: AffectedWorkflow[];
  /** Overall blast radius score 0–100 */
  blast_radius_score: number;
  risk_level: RiskLevel;
  /** Whether sandbox preview is recommended */
  sandbox_recommended: boolean;
  /** Whether rollback plan is required */
  rollback_required: boolean;
  /** Suggested rollback strategy */
  rollback_strategy: 'immediate' | 'phased' | 'canary' | 'none';
  /** Pre-flight checks */
  preflight_checks: PreflightCheck[];
}

export interface ImpactedModule {
  module_key: string;
  module_label: string;
  domain: 'saas' | 'tenant';
  impact_type: 'direct' | 'transitive';
  is_mandatory: boolean;
  /** Depth from source (1 = direct, 2+ = transitive) */
  depth: number;
  risk_level: RiskLevel;
}

export interface AffectedTenant {
  tenant_id: string;
  tenant_name: string;
  plan_tier: 'enterprise' | 'professional' | 'starter';
  impact_severity: RiskLevel;
  /** Modules this tenant uses that are in the blast radius */
  affected_modules: string[];
  /** Whether this tenant has active sandbox preview */
  has_active_sandbox: boolean;
}

export interface AffectedWorkflow {
  workflow_id: string;
  workflow_name: string;
  workflow_type: 'onboarding' | 'offboarding' | 'payroll' | 'compliance' | 'approval' | 'automation';
  /** Modules this workflow depends on */
  depends_on_modules: string[];
  /** Whether workflow will break */
  will_break: boolean;
  /** Severity of impact */
  impact_severity: RiskLevel;
}

export interface PreflightCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  description: string;
}

export interface CouplingMetrics {
  module_key: string;
  afferent_coupling: number;  // Ca — modules that depend on this
  efferent_coupling: number;  // Ce — modules this depends on
  instability: number;        // Ce / (Ca + Ce), 0=stable, 1=unstable
  abstractness: number;       // proxy: event count / total events
  distance_from_main_seq: number;
  /** Bidirectional deps this module participates in */
  bidirectional_count: number;
  /** Cross-domain violations this module participates in */
  cross_domain_violation_count: number;
  /** Whether module is excessively connected (Ca+Ce >= threshold) */
  is_excessively_connected: boolean;
  /** Zone classification */
  zone: 'main_sequence' | 'zone_of_pain' | 'zone_of_uselessness' | 'balanced';
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
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  if (score >= 1) return 'low';
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

/** Detect all bidirectional dependencies in the graph */
function detectBidirectionalDeps(edges: DependencyEdge[]): BidirectionalDependency[] {
  const pairs = new Map<string, BidirectionalDependency>();
  for (const e of edges) {
    const reverse = edges.find(r => r.from === e.to && r.to === e.from);
    if (reverse) {
      const key = [e.from, e.to].sort().join('↔');
      if (!pairs.has(key)) {
        pairs.set(key, {
          module_a: e.from,
          module_b: e.to,
          a_to_b_mandatory: e.is_mandatory,
          b_to_a_mandatory: reverse.is_mandatory,
        });
      }
    }
  }
  return Array.from(pairs.values());
}

/** Detect cross-domain (SaaS↔Tenant) dependency violations */
function detectCrossDomainViolations(
  edges: DependencyEdge[],
  modules: ArchModuleInfo[],
): CrossDomainViolation[] {
  const domainMap = new Map(modules.map(m => [m.key, m.domain]));
  const violations: CrossDomainViolation[] = [];

  for (const e of edges) {
    const fromDomain = domainMap.get(e.from);
    const toDomain = domainMap.get(e.to);
    if (!fromDomain || !toDomain || fromDomain === toDomain) continue;

    // SaaS → Tenant direct dependency is a violation (should use events only)
    if (fromDomain === 'saas' && toDomain === 'tenant') {
      violations.push({
        from_module: e.from,
        from_domain: 'saas',
        to_module: e.to,
        to_domain: 'tenant',
        is_mandatory: e.is_mandatory,
        direction: 'saas→tenant',
        violation_type: 'direct_dependency',
        description: `Platform "${e.from}" depende diretamente de Tenant "${e.to}" — deveria usar eventos normalizados`,
      });
    }

    // Tenant → SaaS mutation dependency (tenant should only read from platform)
    if (fromDomain === 'tenant' && toDomain === 'saas' && e.is_mandatory) {
      violations.push({
        from_module: e.from,
        from_domain: 'tenant',
        to_module: e.to,
        to_domain: 'saas',
        is_mandatory: e.is_mandatory,
        direction: 'tenant→saas',
        violation_type: 'mutation',
        description: `Tenant "${e.from}" tem dependência mandatória de Platform "${e.to}" — verificar se é apenas leitura`,
      });
    }
  }
  return violations;
}

const EXCESSIVE_CONNECTION_THRESHOLD = 6;

function analyzeCoupling(
  moduleKey: string,
  edges: DependencyEdge[],
  modules: ArchModuleInfo[],
  bidirectionalDeps: BidirectionalDependency[],
  crossDomainViolations: CrossDomainViolation[],
): { metrics: CouplingMetrics; score: number; factors: RiskFactor[] } {
  const ca = edges.filter(e => e.to === moduleKey).length;
  const ce = edges.filter(e => e.from === moduleKey).length;
  const instability = ca + ce > 0 ? ce / (ca + ce) : 0;

  const mod = modules.find(m => m.key === moduleKey);
  const totalEvents = modules.reduce((s, m) => s + m.emits_events.length, 0) || 1;
  const abstractness = (mod?.emits_events.length ?? 0) / totalEvents;
  const distance = Math.abs(instability + abstractness - 1);

  const biDirCount = bidirectionalDeps.filter(b => b.module_a === moduleKey || b.module_b === moduleKey).length;
  const crossViolCount = crossDomainViolations.filter(v => v.from_module === moduleKey || v.to_module === moduleKey).length;
  const isExcessive = (ca + ce) >= EXCESSIVE_CONNECTION_THRESHOLD;

  // Zone classification
  let zone: CouplingMetrics['zone'] = 'balanced';
  if (distance <= 0.2) zone = 'main_sequence';
  else if (instability < 0.3 && abstractness < 0.3) zone = 'zone_of_pain';
  else if (instability > 0.7 && abstractness > 0.7) zone = 'zone_of_uselessness';

  const factors: RiskFactor[] = [];
  let score = 0;

  // Distance from main sequence
  if (distance > 0.7) {
    score += 25;
    factors.push({ category: 'coupling', severity: 'high', description: `Distância da main sequence: ${distance.toFixed(2)} (${zone === 'zone_of_pain' ? 'zona de dor' : 'zona de inutilidade'})`, metric_value: distance });
  } else if (distance > 0.4) {
    score += 12;
    factors.push({ category: 'coupling', severity: 'medium', description: `Distância da main sequence: ${distance.toFixed(2)}`, metric_value: distance });
  }

  // Instability
  if (instability > 0.8 && ce >= 3) {
    score += 15;
    factors.push({ category: 'coupling', severity: 'high', description: `Instabilidade alta (${instability.toFixed(2)}): muito dependente de outros`, metric_value: instability });
  }

  // Bidirectional dependencies
  if (biDirCount >= 2) {
    score += 20;
    factors.push({ category: 'coupling', severity: 'critical', description: `${biDirCount} dependências bidirecionais — acoplamento mútuo alto`, metric_value: biDirCount });
  } else if (biDirCount === 1) {
    score += 10;
    factors.push({ category: 'coupling', severity: 'medium', description: `1 dependência bidirecional detectada`, metric_value: 1 });
  }

  // Cross-domain violations
  if (crossViolCount > 0) {
    score += 20;
    factors.push({ category: 'coupling', severity: 'critical', description: `${crossViolCount} violação(ões) de isolamento SaaS↔Tenant`, metric_value: crossViolCount });
  }

  // Excessively connected
  if (isExcessive) {
    score += 10;
    factors.push({ category: 'coupling', severity: 'high', description: `Módulo excessivamente conectado: ${ca + ce} conexões diretas (limiar: ${EXCESSIVE_CONNECTION_THRESHOLD})`, metric_value: ca + ce });
  }

  return {
    metrics: {
      module_key: moduleKey,
      afferent_coupling: ca,
      efferent_coupling: ce,
      instability,
      abstractness,
      distance_from_main_seq: distance,
      bidirectional_count: biDirCount,
      cross_domain_violation_count: crossViolCount,
      is_excessively_connected: isExcessive,
      zone,
    },
    score: clamp(score),
    factors,
  };
}

// ── 3. CircularDependencyDetector (DFS) ──

function detectCircularDependencies(
  edges: DependencyEdge[],
  modules?: ArchModuleInfo[],
): CircularDependencyCycle[] {
  const graph = new Map<string, string[]>();
  for (const e of edges) {
    if (!graph.has(e.from)) graph.set(e.from, []);
    graph.get(e.from)!.push(e.to);
  }

  const edgeMap = new Map<string, DependencyEdge>();
  for (const e of edges) {
    edgeMap.set(`${e.from}→${e.to}`, e);
  }

  const domainMap = new Map<string, 'saas' | 'tenant'>();
  const labelMap = new Map<string, string>();
  if (modules) {
    for (const m of modules) {
      domainMap.set(m.key, m.domain);
      labelMap.set(m.key, m.label);
    }
  }

  const rawCycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        rawCycles.push(path.slice(cycleStart).concat(node));
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

  // Deduplicate and enrich cycles
  const seen = new Set<string>();
  return rawCycles
    .map(c => {
      const sorted = [...c].sort().join('→');
      if (seen.has(sorted)) return null;
      seen.add(sorted);

      const uniqueNodes = c.slice(0, -1); // remove repeated start node
      const depth = uniqueNodes.length;

      // Check edges in the cycle for mandatory status
      let hasMandatoryEdge = false;
      for (let i = 0; i < c.length - 1; i++) {
        const edge = edgeMap.get(`${c[i]}→${c[i + 1]}`);
        if (edge?.is_mandatory) {
          hasMandatoryEdge = true;
          break;
        }
      }

      // Check cross-domain
      const domainsInvolved = [...new Set(uniqueNodes.map(k => domainMap.get(k)).filter(Boolean))] as ('saas' | 'tenant')[];
      const isCrossDomain = domainsInvolved.length > 1;

      // Determine severity
      let severity: RiskLevel;
      if (isCrossDomain && hasMandatoryEdge) severity = 'critical';
      else if (hasMandatoryEdge || depth >= 4) severity = 'critical';
      else if (isCrossDomain || depth >= 3) severity = 'high';
      else severity = 'medium';

      // Determine blocking status
      const isBlocking = severity === 'critical' || (hasMandatoryEdge && isCrossDomain);
      let blockingReason: string;
      if (isBlocking && isCrossDomain && hasMandatoryEdge) {
        blockingReason = `Ciclo crítico com dependência mandatória cruzando camadas SaaS↔Tenant — BLOQUEANTE: viola isolamento arquitetural`;
      } else if (isBlocking && hasMandatoryEdge) {
        blockingReason = `Ciclo com dependência mandatória de ${depth} módulos — BLOQUEANTE: falha em qualquer nó propaga para todo o ciclo`;
      } else if (isBlocking) {
        blockingReason = `Ciclo crítico de ${depth} módulos — BLOQUEANTE: risco estrutural alto`;
      } else {
        blockingReason = `Ciclo de ${depth} módulos — monitorar, não bloqueante no momento`;
      }

      return {
        cycle: c,
        cycle_labels: c.map(k => labelMap.get(k) ?? k),
        severity,
        depth,
        has_mandatory_edge: hasMandatoryEdge,
        is_cross_domain: isCrossDomain,
        domains_involved: domainsInvolved,
        is_blocking: isBlocking,
        blocking_reason: blockingReason,
      };
    })
    .filter(Boolean) as CircularDependencyCycle[];
}

// ── 4. CriticalModuleIdentifier ──

/**
 * Simulated incident data per module.
 * In production this would come from the IncidentManagementEngine / DB.
 */
function getModuleIncidentData(moduleKey: string): {
  incident_count_30d: number; sev1_count: number; sev2_count: number; has_recent_critical: boolean;
} {
  // Simulated: core modules have higher incident history
  const coreModules = ['iam', 'security_kernel', 'core_hr', 'tenant_module', 'billing'];
  const isCore = coreModules.includes(moduleKey);
  return {
    incident_count_30d: isCore ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 2),
    sev1_count: isCore ? Math.floor(Math.random() * 2) : 0,
    sev2_count: isCore ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 1),
    has_recent_critical: isCore && Math.random() > 0.6,
  };
}

function computeTransitiveDependents(moduleKey: string, edges: DependencyEdge[]): number {
  const reverseGraph = new Map<string, string[]>();
  for (const e of edges) {
    if (!reverseGraph.has(e.to)) reverseGraph.set(e.to, []);
    reverseGraph.get(e.to)!.push(e.from);
  }
  const visited = new Set<string>();
  const queue = [moduleKey];
  while (queue.length) {
    const current = queue.shift()!;
    for (const dep of reverseGraph.get(current) ?? []) {
      if (!visited.has(dep) && dep !== moduleKey) {
        visited.add(dep);
        queue.push(dep);
      }
    }
  }
  return visited.size;
}

function identifyCriticality(
  mod: ArchModuleInfo,
  fanIn: number,
  edges: DependencyEdge[],
): { detail: CriticalityIndex; score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let slaScore = 0;
  let centralityScore = 0;
  let incidentScore = 0;
  let usageScore = 0;

  // ── SLA tier (0–40) ──
  if (mod.sla.tier === 'critical') {
    slaScore = 40;
    factors.push({ category: 'criticality', severity: 'critical', description: `SLA tier: critical (${mod.sla.uptime_target}, RTO: ${mod.sla.rto_minutes ?? '?'}min)`, metric_value: 40 });
  } else if (mod.sla.tier === 'high') {
    slaScore = 25;
    factors.push({ category: 'criticality', severity: 'high', description: `SLA tier: high (${mod.sla.uptime_target})`, metric_value: 25 });
  } else if (mod.sla.tier === 'standard') {
    slaScore = 10;
  }

  // ── Dependency centrality (0–25) ──
  const transitiveDeps = computeTransitiveDependents(mod.key, edges);
  if (fanIn >= 5 || transitiveDeps >= 8) {
    centralityScore = 25;
    factors.push({ category: 'criticality', severity: 'critical', description: `Centralidade crítica: ${fanIn} diretos, ${transitiveDeps} transitivos dependem deste módulo`, metric_value: transitiveDeps });
  } else if (fanIn >= 3 || transitiveDeps >= 4) {
    centralityScore = 15;
    factors.push({ category: 'criticality', severity: 'high', description: `Centralidade alta: ${fanIn} diretos, ${transitiveDeps} transitivos`, metric_value: transitiveDeps });
  } else if (fanIn >= 1) {
    centralityScore = 5;
  }

  // ── Incident history (0–20) ──
  const incidents = getModuleIncidentData(mod.key);
  if (incidents.sev1_count > 0) {
    incidentScore += 15;
    factors.push({ category: 'criticality', severity: 'critical', description: `${incidents.sev1_count} incidente(s) Sev1 nos últimos 30 dias`, metric_value: incidents.sev1_count });
  }
  if (incidents.sev2_count >= 2) {
    incidentScore += 5;
    factors.push({ category: 'criticality', severity: 'high', description: `${incidents.sev2_count} incidentes Sev2 nos últimos 30 dias`, metric_value: incidents.sev2_count });
  }
  if (incidents.has_recent_critical) {
    incidentScore = Math.min(20, incidentScore + 5);
    factors.push({ category: 'criticality', severity: 'critical', description: 'Incidente crítico recente ativo — módulo sob observação', metric_value: 1 });
  }
  incidentScore = Math.min(20, incidentScore);

  // ── Usage / domain weight (0–15) ──
  const isSaasCore = mod.domain === 'saas';
  const eventSurface = mod.emits_events.length + mod.consumes_events.length;

  if (isSaasCore) {
    usageScore += 10;
    factors.push({ category: 'criticality', severity: 'medium', description: 'Módulo SaaS Core — impacto global em todos os tenants', metric_value: 10 });
  }
  if (eventSurface >= 4) {
    usageScore += 5;
    factors.push({ category: 'criticality', severity: 'medium', description: `Superfície de integração alta: ${eventSurface} eventos (emite + consome)`, metric_value: eventSurface });
  }
  usageScore = Math.min(15, usageScore);

  const totalScore = clamp(slaScore + centralityScore + incidentScore + usageScore);

  const detail: CriticalityIndex = {
    module_key: mod.key,
    module_label: mod.label,
    domain: mod.domain,
    criticality_index: totalScore,
    risk_level: riskLevel(totalScore),
    sla_score: slaScore,
    sla_tier: mod.sla.tier,
    centrality_score: centralityScore,
    fan_in: fanIn,
    incident_score: incidentScore,
    incident_count_30d: incidents.incident_count_30d,
    sev1_count: incidents.sev1_count,
    sev2_count: incidents.sev2_count,
    has_recent_critical_incident: incidents.has_recent_critical,
    usage_score: usageScore,
    is_saas_core: isSaasCore,
    event_surface: eventSurface,
    transitive_dependents: transitiveDeps,
    factors,
  };

  return { detail, score: totalScore, factors };
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

// ── 5b. Full Change Impact Prediction ──

/** Simulated tenant data */
const SIMULATED_TENANTS: Array<{ tenant_id: string; tenant_name: string; plan_tier: 'enterprise' | 'professional' | 'starter'; active_modules: string[] }> = [
  { tenant_id: 't-001', tenant_name: 'Acme Corp', plan_tier: 'enterprise', active_modules: ['core_hr', 'payroll', 'benefits', 'agreements', 'esocial', 'sst', 'iam', 'tenant_module', 'analytics_module'] },
  { tenant_id: 't-002', tenant_name: 'TechFlow Ltda', plan_tier: 'professional', active_modules: ['core_hr', 'payroll', 'time_tracking', 'iam', 'tenant_module', 'agreements'] },
  { tenant_id: 't-003', tenant_name: 'Globex Industries', plan_tier: 'enterprise', active_modules: ['core_hr', 'payroll', 'benefits', 'esocial', 'sst', 'iam', 'tenant_module', 'fleet_module', 'analytics_module', 'agreements'] },
  { tenant_id: 't-004', tenant_name: 'StartUp Brasil', plan_tier: 'starter', active_modules: ['core_hr', 'payroll', 'iam', 'tenant_module'] },
  { tenant_id: 't-005', tenant_name: 'Construtora Atlas', plan_tier: 'professional', active_modules: ['core_hr', 'payroll', 'sst', 'iam', 'tenant_module', 'time_tracking'] },
];

/** Simulated workflows */
const SIMULATED_WORKFLOWS: AffectedWorkflow[] = [
  { workflow_id: 'wf-onb-001', workflow_name: 'Admissão Digital', workflow_type: 'onboarding', depends_on_modules: ['core_hr', 'agreements', 'iam', 'tenant_module'], will_break: false, impact_severity: 'none' },
  { workflow_id: 'wf-off-001', workflow_name: 'Desligamento Completo', workflow_type: 'offboarding', depends_on_modules: ['core_hr', 'payroll', 'benefits', 'agreements'], will_break: false, impact_severity: 'none' },
  { workflow_id: 'wf-pay-001', workflow_name: 'Fechamento de Folha', workflow_type: 'payroll', depends_on_modules: ['payroll', 'benefits', 'time_tracking', 'esocial'], will_break: false, impact_severity: 'none' },
  { workflow_id: 'wf-comp-001', workflow_name: 'Envio eSocial', workflow_type: 'compliance', depends_on_modules: ['esocial', 'core_hr', 'payroll', 'sst'], will_break: false, impact_severity: 'none' },
  { workflow_id: 'wf-appr-001', workflow_name: 'Aprovação de Férias', workflow_type: 'approval', depends_on_modules: ['core_hr', 'tenant_module'], will_break: false, impact_severity: 'none' },
  { workflow_id: 'wf-auto-001', workflow_name: 'Automação de Benefícios', workflow_type: 'automation', depends_on_modules: ['benefits', 'core_hr', 'payroll'], will_break: false, impact_severity: 'none' },
];

function buildFullChangeImpactPrediction(
  mod: ArchModuleInfo,
  edges: DependencyEdge[],
  modules: ArchModuleInfo[],
): ChangeImpactPrediction {
  // 1. Compute impacted modules with depth via BFS
  const reverseGraph = new Map<string, Array<{ target: string; is_mandatory: boolean }>>();
  for (const e of edges) {
    if (!reverseGraph.has(e.to)) reverseGraph.set(e.to, []);
    reverseGraph.get(e.to)!.push({ target: e.from, is_mandatory: e.is_mandatory });
  }

  const impactedModules: ImpactedModule[] = [];
  const visited = new Set<string>();
  const queue: Array<{ key: string; depth: number; is_mandatory: boolean }> = [];

  // Seed: direct dependents
  for (const dep of reverseGraph.get(mod.key) ?? []) {
    if (dep.target !== mod.key) {
      queue.push({ key: dep.target, depth: 1, is_mandatory: dep.is_mandatory });
    }
  }

  while (queue.length) {
    const { key, depth, is_mandatory } = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);

    const depMod = modules.find(m => m.key === key);
    impactedModules.push({
      module_key: key,
      module_label: depMod?.label ?? key,
      domain: depMod?.domain ?? 'tenant',
      impact_type: depth === 1 ? 'direct' : 'transitive',
      is_mandatory,
      depth,
      risk_level: is_mandatory && depth <= 2 ? 'high' : depth <= 2 ? 'medium' : 'low',
    });

    for (const next of reverseGraph.get(key) ?? []) {
      if (!visited.has(next.target)) {
        queue.push({ key: next.target, depth: depth + 1, is_mandatory: next.is_mandatory });
      }
    }
  }

  impactedModules.sort((a, b) => a.depth - b.depth || (b.is_mandatory ? 1 : 0) - (a.is_mandatory ? 1 : 0));

  const impactedKeys = new Set([mod.key, ...impactedModules.map(m => m.module_key)]);

  // 2. Affected tenants
  const affectedTenants: AffectedTenant[] = SIMULATED_TENANTS
    .map(t => {
      const affectedMods = t.active_modules.filter(m => impactedKeys.has(m));
      if (affectedMods.length === 0 && !impactedKeys.has(mod.key)) return null;
      // SaaS modules affect ALL tenants
      const isSaasChange = mod.domain === 'saas';
      if (!isSaasChange && affectedMods.length === 0) return null;

      const severity: RiskLevel = affectedMods.length >= 3 ? 'critical' :
        affectedMods.length >= 2 ? 'high' :
        isSaasChange ? 'medium' : 'low';

      return {
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        plan_tier: t.plan_tier,
        impact_severity: severity,
        affected_modules: isSaasChange ? [mod.key, ...affectedMods] : affectedMods,
        has_active_sandbox: Math.random() > 0.7, // simulated
      };
    })
    .filter(Boolean) as AffectedTenant[];

  // 3. Affected workflows
  const affectedWorkflows: AffectedWorkflow[] = SIMULATED_WORKFLOWS
    .map(wf => {
      const overlapping = wf.depends_on_modules.filter(m => impactedKeys.has(m));
      if (overlapping.length === 0) return null;
      const willBreak = overlapping.some(m => {
        const imp = impactedModules.find(i => i.module_key === m);
        return imp?.is_mandatory && imp.depth <= 1;
      }) || overlapping.includes(mod.key);

      const severity: RiskLevel = willBreak ? 'critical' :
        overlapping.length >= 2 ? 'high' : 'medium';

      return { ...wf, will_break: willBreak, impact_severity: severity };
    })
    .filter(Boolean) as AffectedWorkflow[];

  // 4. Blast radius score
  const radius = impactedModules.length;
  let blastScore = 0;
  if (radius >= 8) blastScore = 90;
  else if (radius >= 5) blastScore = 65;
  else if (radius >= 3) blastScore = 40;
  else if (radius >= 1) blastScore = 20;

  // Amplify if tenants or workflows affected
  if (affectedTenants.length >= 4) blastScore = Math.min(100, blastScore + 10);
  if (affectedWorkflows.filter(w => w.will_break).length >= 2) blastScore = Math.min(100, blastScore + 10);

  // 5. Sandbox & Rollback decisions
  const sandboxRecommended = blastScore >= 40 || affectedTenants.some(t => t.plan_tier === 'enterprise');
  const rollbackRequired = blastScore >= 60 || affectedWorkflows.some(w => w.will_break);
  const rollbackStrategy: ChangeImpactPrediction['rollback_strategy'] =
    blastScore >= 80 ? 'immediate' :
    blastScore >= 60 ? 'phased' :
    blastScore >= 40 ? 'canary' : 'none';

  // 6. Preflight checks
  const preflightChecks: PreflightCheck[] = [
    {
      id: 'pf-deps',
      label: 'Validação de Dependências',
      status: impactedModules.filter(m => m.is_mandatory).length > 3 ? 'fail' : impactedModules.filter(m => m.is_mandatory).length > 0 ? 'warn' : 'pass',
      description: `${impactedModules.filter(m => m.is_mandatory).length} dependências mandatórias no blast radius`,
    },
    {
      id: 'pf-tenants',
      label: 'Tenants Impactados',
      status: affectedTenants.filter(t => t.plan_tier === 'enterprise').length > 0 ? 'warn' : 'pass',
      description: `${affectedTenants.length} tenant(s) afetado(s), ${affectedTenants.filter(t => t.plan_tier === 'enterprise').length} enterprise`,
    },
    {
      id: 'pf-workflows',
      label: 'Workflows Críticos',
      status: affectedWorkflows.some(w => w.will_break) ? 'fail' : affectedWorkflows.length > 0 ? 'warn' : 'pass',
      description: `${affectedWorkflows.length} workflow(s) afetado(s), ${affectedWorkflows.filter(w => w.will_break).length} vão quebrar`,
    },
    {
      id: 'pf-sandbox',
      label: 'Sandbox Preview',
      status: sandboxRecommended ? 'warn' : 'pass',
      description: sandboxRecommended ? 'Recomendado ativar sandbox preview antes do deploy' : 'Sandbox não obrigatório',
    },
    {
      id: 'pf-rollback',
      label: 'Plano de Rollback',
      status: rollbackRequired ? 'fail' : 'pass',
      description: rollbackRequired ? `Rollback obrigatório — estratégia: ${rollbackStrategy}` : 'Rollback não obrigatório',
    },
  ];

  return {
    module_key: mod.key,
    module_label: mod.label,
    domain: mod.domain,
    impacted_modules: impactedModules,
    affected_tenants: affectedTenants,
    affected_workflows: affectedWorkflows,
    blast_radius_score: clamp(blastScore),
    risk_level: riskLevel(blastScore),
    sandbox_recommended: sandboxRecommended,
    rollback_required: rollbackRequired,
    rollback_strategy: rollbackStrategy,
    preflight_checks: preflightChecks,
  };
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

function generateSuggestions(
  profile: Omit<ModuleRiskProfile, 'suggestions'>,
  couplingMetrics?: CouplingMetrics,
  bidirectionalDeps?: BidirectionalDependency[],
  crossDomainViolations?: CrossDomainViolation[],
): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const mk = profile.module_key;
  const ml = profile.module_label;

  // ── 1. Desacoplamento ──

  if (profile.circular_risk > 0) {
    suggestions.push({
      id: `refactor-circular-${mk}`,
      priority: 'critical',
      title: `Quebrar ciclo circular de ${ml}`,
      description: 'Introduzir event bus ou mediator pattern para eliminar dependência circular. Aplique Dependency Inversion: ambos os módulos dependem de uma abstração compartilhada, nunca um do outro diretamente.',
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  if (profile.dependency_risk >= 61) {
    suggestions.push({
      id: `refactor-decouple-fanin-${mk}`,
      priority: 'high',
      title: `Desacoplar dependentes de ${ml}`,
      description: `Fan-in elevado indica que muitos módulos dependem diretamente. Extraia interfaces estáveis (ports/adapters) para que dependentes usem contratos, não a implementação concreta. Considere facade pattern para agrupar operações.`,
      affected_modules: [mk],
      effort_estimate: 'medium',
    });
  }

  if (profile.dependency_risk_detail.is_fragile) {
    suggestions.push({
      id: `refactor-decouple-fanout-${mk}`,
      priority: 'high',
      title: `Reduzir dependências de ${ml}`,
      description: `Módulo frágil com fan-out de ${profile.dependency_risk_detail.fan_out}. Cada dependência é um ponto de falha. Agrupe dependências atrás de um gateway/agregador ou substitua chamadas diretas por eventos assíncronos.`,
      affected_modules: [mk],
      effort_estimate: 'medium',
    });
  }

  // ── 2. Separação de Domínio ──

  const moduleViolations = crossDomainViolations?.filter(v => v.from_module === mk || v.to_module === mk) ?? [];
  if (moduleViolations.length > 0) {
    const saasToTenant = moduleViolations.filter(v => v.direction === 'saas→tenant');
    const tenantToSaas = moduleViolations.filter(v => v.direction === 'tenant→saas');

    if (saasToTenant.length > 0) {
      suggestions.push({
        id: `refactor-domain-isolation-s2t-${mk}`,
        priority: 'critical',
        title: `Isolar ${ml} da camada Tenant`,
        description: `Platform/SaaS não deve depender diretamente de módulos Tenant (${saasToTenant.map(v => v.to_module).join(', ')}). Substitua por eventos normalizados (domain events) que o Tenant subscreve. O SaaS emite, Tenant reage — nunca o contrário.`,
        affected_modules: [mk, ...saasToTenant.map(v => v.to_module)],
        effort_estimate: 'large',
      });
    }

    if (tenantToSaas.length > 0 && tenantToSaas.some(v => v.is_mandatory)) {
      suggestions.push({
        id: `refactor-domain-isolation-t2s-${mk}`,
        priority: 'high',
        title: `Converter dependência mandatória de ${ml} para leitura`,
        description: `Tenant tem dependência mandatória em Platform (${tenantToSaas.map(v => v.to_module).join(', ')}). Refatore para que Tenant apenas consulte catálogos/configurações via interface de leitura (query), sem mutações diretas na camada Platform.`,
        affected_modules: [mk, ...tenantToSaas.map(v => v.to_module)],
        effort_estimate: 'medium',
      });
    }
  }

  // ── 3. Divisão de Módulo ──

  const totalConnections = profile.dependency_risk_detail.total_direct_dependencies;
  const eventSurface = profile.criticality_detail.event_surface;

  if (totalConnections >= 8 || (totalConnections >= 6 && eventSurface >= 6)) {
    suggestions.push({
      id: `refactor-split-${mk}`,
      priority: 'high',
      title: `Dividir ${ml} em sub-módulos`,
      description: `Módulo excessivamente conectado (${totalConnections} conexões diretas, ${eventSurface} eventos). Indício de God Module. Identifique responsabilidades distintas e extraia sub-módulos coesos com Single Responsibility Principle. Ex: separar lógica de negócio, integração e apresentação.`,
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  if (profile.criticality_score >= 61 && profile.dependency_risk >= 41) {
    suggestions.push({
      id: `refactor-split-critical-${mk}`,
      priority: 'critical',
      title: `Decompor módulo crítico ${ml}`,
      description: `Módulo é simultaneamente crítico (score ${profile.criticality_score}) e com alto risco de dependência (${profile.dependency_risk}). Separe o core estável (API pública + contratos) de partes voláteis (regras de negócio, integrações). O core permanece imutável enquanto as partes voláteis evoluem independentemente.`,
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  // ── 4. Event-Driven ao invés de chamada direta ──

  const moduleBiDirs = bidirectionalDeps?.filter(b => b.module_a === mk || b.module_b === mk) ?? [];
  if (moduleBiDirs.length > 0) {
    const peers = moduleBiDirs.map(b => b.module_a === mk ? b.module_b : b.module_a);
    suggestions.push({
      id: `refactor-eventdriven-bidir-${mk}`,
      priority: 'critical',
      title: `Converter ${ml} ↔ ${peers.join(', ')} para event-driven`,
      description: `Dependência bidirecional detectada. Substitua chamadas diretas por domain events: ${ml} emite eventos que ${peers.join(', ')} consome(m) e vice-versa. Use um event bus central (PlatformEventBus) para desacoplar completamente. Padrão: emit → subscribe → handle.`,
      affected_modules: [mk, ...peers],
      effort_estimate: 'large',
    });
  }

  if (profile.coupling_risk >= 31 && couplingMetrics) {
    if (couplingMetrics.instability > 0.7 && couplingMetrics.efferent_coupling >= 3) {
      suggestions.push({
        id: `refactor-eventdriven-unstable-${mk}`,
        priority: 'high',
        title: `Substituir chamadas diretas de ${ml} por eventos`,
        description: `Módulo instável (I=${couplingMetrics.instability.toFixed(2)}) com ${couplingMetrics.efferent_coupling} dependências de saída. Converta chamadas síncronas em eventos assíncronos: ao invés de \`moduleB.doAction()\`, emita \`${mk}.action_requested\` e deixe o módulo alvo reagir. Reduz acoplamento temporal e permite retry/replay.`,
        affected_modules: [mk],
        effort_estimate: 'medium',
      });
    }

    if (couplingMetrics.zone === 'zone_of_pain') {
      suggestions.push({
        id: `refactor-abstract-${mk}`,
        priority: 'high',
        title: `Aumentar abstração de ${ml}`,
        description: `Módulo na Zona de Dor (alta estabilidade + baixa abstração). Introduza interfaces/contratos que outros módulos consumam. Exponha capabilities via eventos em vez de API direta. Isso permite evolução sem quebrar dependentes.`,
        affected_modules: [mk],
        effort_estimate: 'medium',
      });
    }

    if (couplingMetrics.zone === 'zone_of_uselessness') {
      suggestions.push({
        id: `refactor-consolidate-${mk}`,
        priority: 'medium',
        title: `Consolidar ou remover ${ml}`,
        description: `Módulo na Zona de Inutilidade (alta instabilidade + alta abstração). Abstrações sem uso real. Considere consolidar com outro módulo ou remover se não há consumidores reais dos contratos expostos.`,
        affected_modules: [mk],
        effort_estimate: 'small',
      });
    }
  }

  if (profile.change_impact_radius >= 5) {
    suggestions.push({
      id: `refactor-blast-eventdriven-${mk}`,
      priority: 'high',
      title: `Limitar propagação de mudanças de ${ml}`,
      description: `Blast radius de ${profile.change_impact_radius} módulos. Use versionamento semântico estrito nos contratos + eventos versionados (v1, v2) para permitir evolução sem forçar atualização simultânea de todos os dependentes. Implemente anti-corruption layers nos consumidores.`,
      affected_modules: [mk],
      effort_estimate: 'large',
    });
  }

  // ── 5. Resiliência (para módulos críticos) ──

  if (profile.criticality_score >= 61 && profile.dependency_risk >= 31) {
    suggestions.push({
      id: `refactor-resilience-${mk}`,
      priority: 'critical',
      title: `Implementar resiliência em ${ml}`,
      description: 'Módulo crítico com exposição a dependências. Implementar: circuit breakers para chamadas externas, fallbacks com degradação graceful, bulkheads para isolamento de falhas, e health checks ativos. Priorizar operações idempotentes e retry com backoff.',
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
  getDependencyRiskScores(): DependencyRiskScore[];
  getBidirectionalDependencies(): BidirectionalDependency[];
  getCrossDomainViolations(): CrossDomainViolation[];
  getCriticalityIndexes(): CriticalityIndex[];
  getChangeImpactPredictions(): ChangeImpactPrediction[];
  getChangeImpactForModule(moduleKey: string): ChangeImpactPrediction | null;
}

export function createArchitectureRiskAnalyzer(): ArchitectureRiskAnalyzerAPI {
  const engine = createArchitectureIntelligenceEngine();
  const modules = engine.getModules();
  const edges = engine.getDependencyEdges();
  const totalModules = modules.length;

  // Pre-compute shared analyses
  const cycles = detectCircularDependencies(edges, modules);
  const modulesInCycles = new Set<string>();
  for (const c of cycles) {
    for (const k of c.cycle) modulesInCycles.add(k);
  }
  const bidirectionalDeps = detectBidirectionalDeps(edges);
  const crossDomainViolations = detectCrossDomainViolations(edges, modules);

  // Build all profiles
  const profiles: ModuleRiskProfile[] = modules.map(mod => {
    const dep = scanDependencyRisk(mod.key, mod, edges, totalModules);
    const coup = analyzeCoupling(mod.key, edges, modules, bidirectionalDeps, crossDomainViolations);
    const circularScore = modulesInCycles.has(mod.key) ? 100 : 0;
    const crit = identifyCriticality(mod, dep.fanIn, edges);
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
      criticality_detail: crit.detail,
      factors: allFactors,
      suggestions: [] as RefactorSuggestion[],
    };

    const modCoupling = analyzeCoupling(mod.key, edges, modules, bidirectionalDeps, crossDomainViolations).metrics;
    const modBiDirs = bidirectionalDeps.filter(b => b.module_a === mod.key || b.module_b === mod.key);
    const modViolations = crossDomainViolations.filter(v => v.from_module === mod.key || v.to_module === mod.key);
    profileBase.suggestions = generateSuggestions(profileBase, modCoupling, modBiDirs, modViolations);
    return profileBase;
  });

  profiles.sort((a, b) => b.risk_score - a.risk_score);

  const couplingMetrics = modules.map(mod =>
    analyzeCoupling(mod.key, edges, modules, bidirectionalDeps, crossDomainViolations).metrics
  );

  const depScores = profiles
    .map(p => p.dependency_risk_detail)
    .sort((a, b) => b.dependency_risk_score - a.dependency_risk_score);

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

  const critIndexes = profiles
    .map(p => p.criticality_detail)
    .sort((a, b) => b.criticality_index - a.criticality_index);

  // Build full change impact predictions for all modules
  const changeImpactPredictions = modules
    .map(mod => buildFullChangeImpactPrediction(mod, edges, modules))
    .sort((a, b) => b.blast_radius_score - a.blast_radius_score);

  return {
    analyze: () => summary,
    getModuleRisk: (key) => profiles.find(p => p.module_key === key) ?? null,
    getAllProfiles: () => profiles,
    getCouplingMetrics: () => couplingMetrics,
    getCircularDependencies: () => cycles,
    getDependencyRiskScores: () => depScores,
    getBidirectionalDependencies: () => bidirectionalDeps,
    getCrossDomainViolations: () => crossDomainViolations,
    getCriticalityIndexes: () => critIndexes,
    getChangeImpactPredictions: () => changeImpactPredictions,
    getChangeImpactForModule: (key) => changeImpactPredictions.find(p => p.module_key === key) ?? null,
  };
}