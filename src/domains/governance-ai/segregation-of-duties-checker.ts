/**
 * SegregationOfDutiesChecker — SoD conflict detection with policy matrix.
 *
 * Detections:
 *  1. UGE-detected conflicts   — from graph-analyzer's accessConflicts
 *  2. Platform role SoD matrix  — explicit forbidden combinations
 *  3. Cross-domain SoD          — platform + tenant role conflicts
 *
 * Example: PlatformFinance + PlatformSupport → critical alert.
 */

import type { UnifiedGraphSnapshot, UnifiedNode } from '@/domains/security/kernel/unified-graph-engine/types';
import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { GovernanceInsight } from './types';
import { insightId, buildRemediation } from './utils';

// ── SoD Policy Matrix ───────────────────────────────────────────

/**
 * Forbidden role combinations: [slugA, slugB, reason, severity]
 * Slug matching is case-insensitive and supports partial matches.
 */
const SOD_POLICIES: Array<{
  roleA: string;
  roleB: string;
  reason: string;
  severity: 'warning' | 'critical';
}> = [
  {
    roleA: 'platform_finance',
    roleB: 'platform_support',
    reason: 'Finance não pode acumular com Support — risco de manipulação financeira via acesso a dados de cliente',
    severity: 'critical',
  },
  {
    roleA: 'platform_finance',
    roleB: 'platform_delegated_support',
    reason: 'Finance não pode acumular com Suporte Delegado — risco de fraude financeira',
    severity: 'critical',
  },
  {
    roleA: 'platform_fiscal',
    roleB: 'platform_support',
    reason: 'Fiscal não pode acumular com Support — segregação obrigatória por compliance',
    severity: 'critical',
  },
  {
    roleA: 'platform_compliance',
    roleB: 'platform_operations',
    reason: 'Compliance deve ser independente de Operations para garantir imparcialidade',
    severity: 'critical',
  },
  {
    roleA: 'platform_super_admin',
    roleB: 'platform_read_only',
    reason: 'SuperAdmin conflita com ReadOnly — escopo contraditório',
    severity: 'warning',
  },
  {
    roleA: 'platform_finance',
    roleB: 'platform_operations',
    reason: 'Segregação entre operações e finanças previne auto-aprovação de transações',
    severity: 'warning',
  },
];

// ── 1. UGE-detected conflicts (from graph-analyzer) ─────────────

function fromUGEConflicts(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.accessConflicts.map(conflict => ({
    id: insightId(),
    category: 'sod_conflict' as const,
    severity: conflict.severity === 'critical' ? 'critical' as const : 'warning' as const,
    title: `Conflito SoD: ${conflict.user.label}`,
    description: `${conflict.rule}. Isso viola o princípio de segregação de funções.`,
    affected_entities: [
      { type: 'user' as const, id: conflict.user.originalId, label: conflict.user.label, domain: conflict.user.domain },
      ...conflict.roles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
    ],
    recommendation: 'Remover um dos cargos conflitantes ou criar um cargo combinado com restrições adequadas.',
    auto_remediable: false,
    remediation_action: buildRemediation(
      'remove_role',
      `Sugestão: remover cargo de menor prioridade do usuário ${conflict.user.label}`,
      'Reduz risco de fraude por segregação inadequada — requer aprovação manual',
      conflict.roles.map((r, i) => ({
        order: i + 1,
        action: 'evaluate_role_removal',
        target: r.originalId,
        details: `Avaliar remoção do cargo "${r.label}" do usuário`,
      })),
    ),
    confidence: 0.95,
    detected_at: Date.now(),
    source: 'heuristic' as const,
    metadata: { detection_source: 'uge_graph_analyzer' },
  }));
}

// ── 2. Platform Role SoD Matrix ─────────────────────────────────

function fromSoDPolicyMatrix(snapshot: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Build user → role slugs map
  const userRoles = buildUserRolesMap(snapshot);

  // Check every user against every policy
  for (const [userUid, { user, roles }] of userRoles) {
    for (const policy of SOD_POLICIES) {
      const matchA = roles.find(r => matchesSlug(r, policy.roleA));
      const matchB = roles.find(r => matchesSlug(r, policy.roleB));

      if (matchA && matchB) {
        // Deduplicate: skip if UGE already detected this exact combination
        insights.push({
          id: insightId(),
          category: 'sod_conflict',
          severity: policy.severity,
          title: `SoD: ${user.label} — ${matchA.label} + ${matchB.label}`,
          description: policy.reason,
          affected_entities: [
            { type: 'user', id: user.originalId, label: user.label, domain: user.domain },
            { type: 'role', id: matchA.originalId, label: matchA.label, domain: matchA.domain },
            { type: 'role', id: matchB.originalId, label: matchB.label, domain: matchB.domain },
          ],
          recommendation: `Remover "${matchA.label}" ou "${matchB.label}" do usuário ${user.label}. ${policy.reason}.`,
          auto_remediable: false,
          remediation_action: buildRemediation(
            'remove_role',
            `Sugestão: resolver conflito SoD: ${matchA.label} ↔ ${matchB.label}`,
            `Eliminação de conflito de segregação de funções — requer aprovação manual`,
            [
              { order: 1, action: 'evaluate_business_need', target: user.originalId, details: `Determinar qual cargo é essencial para ${user.label}` },
              { order: 2, action: 'remove_role', target: matchB.originalId, details: `Remover "${matchB.label}" (menor prioridade presumida)` },
              { order: 3, action: 'audit_actions', target: user.originalId, details: 'Auditar ações realizadas durante o período de conflito' },
            ],
          ),
          confidence: 0.97,
          detected_at: Date.now(),
          source: 'heuristic',
          metadata: {
            detection_source: 'sod_policy_matrix',
            policy_roleA: policy.roleA,
            policy_roleB: policy.roleB,
          },
        });
      }
    }
  }

  return insights;
}

// ── 3. Cross-Domain SoD ─────────────────────────────────────────

function fromCrossDomainSoD(snapshot: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];
  const userRoles = buildUserRolesMap(snapshot);

  for (const [, { user, roles }] of userRoles) {
    const platformRoles = roles.filter(r => r.domain === 'platform_access');
    const tenantAdminRoles = roles.filter(r =>
      r.domain === 'tenant_access' &&
      (r.label.toLowerCase().includes('admin') || r.label.toLowerCase().includes('super')),
    );

    // User with platform-level roles AND tenant admin roles = elevated risk
    if (platformRoles.length > 0 && tenantAdminRoles.length > 0) {
      insights.push({
        id: insightId(),
        category: 'privilege_escalation',
        severity: 'warning',
        title: `Acesso cross-domain: ${user.label}`,
        description: `Usuário acumula ${platformRoles.length} cargo(s) de plataforma e ${tenantAdminRoles.length} cargo(s) admin de tenant. Risco de escalação de privilégio entre domínios.`,
        affected_entities: [
          { type: 'user', id: user.originalId, label: user.label, domain: user.domain },
          ...platformRoles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
          ...tenantAdminRoles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
        ],
        recommendation: 'Avaliar se o acesso cross-domain é justificável. Aplicar princípio de menor privilégio.',
        auto_remediable: false,
        confidence: 0.85,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: {
          detection_source: 'cross_domain_sod',
          platform_role_count: platformRoles.length,
          tenant_admin_role_count: tenantAdminRoles.length,
        },
      });
    }
  }

  return insights;
}

// ── Helpers ──────────────────────────────────────────────────────

interface UserRoleEntry {
  user: UnifiedNode;
  roles: UnifiedNode[];
}

function buildUserRolesMap(snapshot: UnifiedGraphSnapshot): Map<string, UserRoleEntry> {
  const map = new Map<string, UserRoleEntry>();

  const roleRelations = new Set(['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'] as const);
  for (const edge of snapshot.edges) {
    if (!(roleRelations as Set<string>).has(edge.relation)) continue;
    const userNode = snapshot.nodes.get(edge.from);
    const roleNode = snapshot.nodes.get(edge.to);
    if (!userNode || !roleNode || (userNode.type !== 'platform_user' && userNode.type !== 'tenant_user')) continue;

    if (!map.has(edge.from)) map.set(edge.from, { user: userNode, roles: [] });
    map.get(edge.from)!.roles.push(roleNode);
  }

  return map;
}

function matchesSlug(node: UnifiedNode, slug: string): boolean {
  const nodeSlug = (node.originalId || node.label || '').toLowerCase().replace(/[\s-]/g, '_');
  return nodeSlug.includes(slug) || slug.includes(nodeSlug);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Run all SoD detection strategies and deduplicate results.
 */
export function detectSoDConflicts(
  analysis: AnalysisResult,
  snapshot?: UnifiedGraphSnapshot,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [
    ...fromUGEConflicts(analysis),
  ];

  if (snapshot) {
    const matrixInsights = fromSoDPolicyMatrix(snapshot);
    const crossDomainInsights = fromCrossDomainSoD(snapshot);

    // Deduplicate: skip matrix findings already covered by UGE
    const ugeKeys = new Set(
      insights.map(i => i.affected_entities.map(e => e.id).sort().join('|')),
    );

    for (const insight of [...matrixInsights, ...crossDomainInsights]) {
      const key = insight.affected_entities.map(e => e.id).sort().join('|');
      if (!ugeKeys.has(key)) {
        insights.push(insight);
        ugeKeys.add(key);
      }
    }
  }

  return insights;
}
