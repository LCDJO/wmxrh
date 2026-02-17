/**
 * AccessRiskAnalyzer — Multi-dimensional access risk analysis.
 *
 * Analyzes three risk dimensions:
 *  1. Critical Permissions — users with excessive critical permissions
 *  2. Cross-Domain Access  — simultaneous Platform + Tenant access
 *  3. Impersonation Abuse  — active or recurrent impersonation sessions
 *
 * Generates a composite RiskScore (0-100) per user with dimension breakdown.
 */

import type { RiskAssessment, UserRiskScore } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight, InsightCategory, InsightSeverity } from './types';
import { insightId } from './utils';

// ── Thresholds ──────────────────────────────────────────────────

const CRITICAL_PERM_THRESHOLD = 5;
const MULTI_TENANT_THRESHOLD = 2;
const HIGH_RISK_SCORE = 70;
const CRITICAL_RISK_SCORE = 85;

// ── Dimension weights (must sum to 100) ─────────────────────────

const WEIGHT_CRITICAL_PERMS = 40;
const WEIGHT_CROSS_DOMAIN   = 30;
const WEIGHT_IMPERSONATION  = 30;

// ── Public types ────────────────────────────────────────────────

export interface AccessRiskDimension {
  dimension: 'critical_permissions' | 'cross_domain_access' | 'impersonation_abuse';
  raw_value: number;
  weighted_score: number;
  detail: string;
}

export interface AccessRiskProfile {
  userId: string;
  userLabel: string;
  composite_score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  dimensions: AccessRiskDimension[];
}

// ── Dimension Analyzers ─────────────────────────────────────────

function analyzeCriticalPermissions(user: UserRiskScore): AccessRiskDimension {
  const count = user.factors.criticalPermissionCount;
  // Normalize: 0 perms = 0, ≥10 = max weight
  const normalized = Math.min(count / 10, 1);
  const weighted = Math.round(normalized * WEIGHT_CRITICAL_PERMS);

  return {
    dimension: 'critical_permissions',
    raw_value: count,
    weighted_score: weighted,
    detail: `${count} permissão(ões) crítica(s) atribuída(s)`,
  };
}

function analyzeCrossDomainAccess(user: UserRiskScore): AccessRiskDimension {
  const tenantCount = user.factors.multiTenantCount;
  // Normalize: 1 tenant = 0 risk, ≥4 = max weight
  const normalized = Math.min(Math.max(tenantCount - 1, 0) / 3, 1);
  const weighted = Math.round(normalized * WEIGHT_CROSS_DOMAIN);

  return {
    dimension: 'cross_domain_access',
    raw_value: tenantCount,
    weighted_score: weighted,
    detail: tenantCount > 1
      ? `Acesso simultâneo a ${tenantCount} tenants (Platform + Tenant)`
      : 'Acesso restrito a escopo único',
  };
}

function analyzeImpersonation(user: UserRiskScore): AccessRiskDimension {
  const active = user.factors.hasActiveImpersonation;
  const impScore = user.factors.impersonationScore;
  // impersonationScore is already 0-30 from UGE
  const weighted = Math.round((impScore / 30) * WEIGHT_IMPERSONATION);

  return {
    dimension: 'impersonation_abuse',
    raw_value: impScore,
    weighted_score: weighted,
    detail: active
      ? `Sessão de impersonation ATIVA (score ${impScore}/30)`
      : impScore > 0
        ? `Histórico de impersonation detectado (score ${impScore}/30)`
        : 'Sem registros de impersonation',
  };
}

// ── Profile Builder ─────────────────────────────────────────────

function buildRiskProfile(user: UserRiskScore): AccessRiskProfile {
  const dims = [
    analyzeCriticalPermissions(user),
    analyzeCrossDomainAccess(user),
    analyzeImpersonation(user),
  ];

  const composite = dims.reduce((sum, d) => sum + d.weighted_score, 0);
  const level = composite >= CRITICAL_RISK_SCORE ? 'critical'
    : composite >= HIGH_RISK_SCORE ? 'high'
    : composite >= 40 ? 'medium'
    : 'low';

  return {
    userId: user.userUid,
    userLabel: user.userLabel,
    composite_score: Math.min(composite, 100),
    level,
    dimensions: dims,
  };
}

// ── Insight Generators ──────────────────────────────────────────

function insightForHighRisk(profile: AccessRiskProfile): GovernanceInsight {
  const severity: InsightSeverity = profile.level === 'critical' ? 'critical' : 'warning';
  const topDim = [...profile.dimensions].sort((a, b) => b.weighted_score - a.weighted_score)[0];

  return {
    id: insightId(),
    category: 'privilege_escalation',
    severity,
    title: `Risco elevado: ${profile.userLabel} (score ${profile.composite_score})`,
    description: `Score composto ${profile.composite_score}/100. Principal fator: ${topDim.detail}.`,
    affected_entities: [
      { type: 'user', id: profile.userId, label: profile.userLabel },
    ],
    recommendation: buildRecommendation(profile),
    auto_remediable: false,
    confidence: 0.92,
    detected_at: Date.now(),
    source: 'heuristic',
    metadata: {
      composite_score: profile.composite_score,
      risk_level: profile.level,
      dimensions: profile.dimensions,
    },
  };
}

function insightForExcessivePerms(profile: AccessRiskProfile): GovernanceInsight | null {
  const permDim = profile.dimensions.find(d => d.dimension === 'critical_permissions');
  if (!permDim || permDim.raw_value < CRITICAL_PERM_THRESHOLD) return null;

  return {
    id: insightId(),
    category: 'excessive_permissions',
    severity: permDim.raw_value >= 8 ? 'critical' : 'warning',
    title: `Permissões críticas excessivas: ${profile.userLabel}`,
    description: `${permDim.raw_value} permissões críticas atribuídas. O princípio de menor privilégio recomenda no máximo ${CRITICAL_PERM_THRESHOLD - 1}.`,
    affected_entities: [
      { type: 'user', id: profile.userId, label: profile.userLabel },
    ],
    recommendation: 'Revisar permissões críticas e remover as não utilizadas nos últimos 30 dias.',
    auto_remediable: false,
    confidence: 0.88,
    detected_at: Date.now(),
    source: 'heuristic',
    metadata: { critical_permission_count: permDim.raw_value },
  };
}

function insightForCrossDomain(profile: AccessRiskProfile): GovernanceInsight | null {
  const crossDim = profile.dimensions.find(d => d.dimension === 'cross_domain_access');
  if (!crossDim || crossDim.raw_value < MULTI_TENANT_THRESHOLD) return null;

  return {
    id: insightId(),
    category: 'anomalous_pattern',
    severity: crossDim.raw_value >= 4 ? 'critical' : 'warning',
    title: `Acesso multi-tenant: ${profile.userLabel}`,
    description: `Usuário possui acesso simultâneo a ${crossDim.raw_value} tenants, combinando escopos Platform e Tenant.`,
    affected_entities: [
      { type: 'user', id: profile.userId, label: profile.userLabel },
    ],
    recommendation: 'Validar necessidade de acesso cross-tenant e aplicar restrição de escopo onde possível.',
    auto_remediable: false,
    confidence: 0.85,
    detected_at: Date.now(),
    source: 'heuristic',
    metadata: { tenant_count: crossDim.raw_value },
  };
}

function insightForImpersonation(profile: AccessRiskProfile): GovernanceInsight | null {
  const impDim = profile.dimensions.find(d => d.dimension === 'impersonation_abuse');
  if (!impDim || impDim.raw_value === 0) return null;

  const isActive = impDim.detail.includes('ATIVA');

  return {
    id: insightId(),
    category: 'dormant_access',
    severity: isActive ? 'critical' : 'warning',
    title: isActive
      ? `Impersonation ativa: ${profile.userLabel}`
      : `Impersonation recorrente: ${profile.userLabel}`,
    description: impDim.detail,
    affected_entities: [
      { type: 'user', id: profile.userId, label: profile.userLabel },
    ],
    recommendation: isActive
      ? 'Encerrar sessão de impersonation imediatamente e auditar ações realizadas.'
      : 'Revisar frequência de uso de impersonation e considerar alternativas.',
    auto_remediable: isActive,
    confidence: isActive ? 0.95 : 0.8,
    detected_at: Date.now(),
    source: 'heuristic',
    metadata: { impersonation_score: impDim.raw_value, is_active: isActive },
  };
}

// ── Recommendation Builder ──────────────────────────────────────

function buildRecommendation(profile: AccessRiskProfile): string {
  const parts: string[] = [];
  const sorted = [...profile.dimensions].sort((a, b) => b.weighted_score - a.weighted_score);

  for (const dim of sorted) {
    if (dim.weighted_score === 0) continue;
    switch (dim.dimension) {
      case 'critical_permissions':
        parts.push('reduzir permissões críticas ao mínimo necessário');
        break;
      case 'cross_domain_access':
        parts.push('restringir acesso cross-tenant');
        break;
      case 'impersonation_abuse':
        parts.push('auditar e limitar uso de impersonation');
        break;
    }
  }

  return parts.length > 0
    ? `Ações recomendadas: ${parts.join('; ')}.`
    : 'Monitorar continuamente.';
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Build risk profiles for all users in the assessment.
 */
export function buildAccessRiskProfiles(risk: RiskAssessment): AccessRiskProfile[] {
  return risk.userScores.map(buildRiskProfile);
}

/**
 * Generate governance insights from access risk analysis.
 * Produces granular insights per dimension + composite high-risk alerts.
 */
export function analyzeAccessRisk(risk: RiskAssessment): GovernanceInsight[] {
  const profiles = buildAccessRiskProfiles(risk);
  const insights: GovernanceInsight[] = [];

  for (const profile of profiles) {
    // Composite high-risk insight
    if (profile.composite_score >= HIGH_RISK_SCORE) {
      insights.push(insightForHighRisk(profile));
    }

    // Dimensional insights (only when individually significant)
    const permInsight = insightForExcessivePerms(profile);
    if (permInsight) insights.push(permInsight);

    const crossInsight = insightForCrossDomain(profile);
    if (crossInsight) insights.push(crossInsight);

    const impInsight = insightForImpersonation(profile);
    if (impInsight) insights.push(impInsight);
  }

  return insights;
}
