/**
 * RiskAssessmentService — Evaluates governance risks from the unified graph.
 *
 * Consumes GraphAnalyzer results and produces risk signals:
 *   - Permissões excessivas
 *   - Conflitos de acesso (separation of duty)
 *   - Sobreposição de cargos
 *   - Risco operacional (orphans, depth, unused)
 *   - Super admin count
 *   - Cross-domain users
 */

import type {
  UnifiedGraphSnapshot,
  RiskAssessment,
  RiskSignal,
  RiskLevel,
} from './types';
import { analyzeGraph } from './graph-analyzer';

const MAX_SUPER_ADMINS = 3;

export function assessRisk(snapshot: UnifiedGraphSnapshot): RiskAssessment {
  const analysis = analyzeGraph(snapshot);
  const signals: RiskSignal[] = [];

  // ── 1. Permissões excessivas ──
  for (const ep of analysis.excessivePermissions) {
    signals.push({
      id: `excessive_perms_${ep.user.uid}`,
      level: 'high',
      domain: ep.user.domain,
      title: 'Permissões excessivas',
      detail: `Usuário "${ep.user.label}" possui ${ep.permissionCount} permissões resolvidas — avaliar princípio do menor privilégio.`,
      affectedNodeUids: [ep.user.uid, ...ep.permissions.map(p => p.uid)],
    });
  }

  // ── 2. Conflitos de acesso ──
  for (const conflict of analysis.accessConflicts) {
    signals.push({
      id: `access_conflict_${conflict.user.uid}_${conflict.rule}`,
      level: conflict.severity === 'critical' ? 'critical' : 'high',
      domain: conflict.user.domain,
      title: `Conflito: ${conflict.rule}`,
      detail: `${conflict.detail}. Usuário: "${conflict.user.label}", Cargos: ${conflict.roles.map(r => r.label).join(' + ')}.`,
      affectedNodeUids: [conflict.user.uid, ...conflict.roles.map(r => r.uid)],
    });
  }

  // ── 3. Sobreposição entre cargos ──
  for (const overlap of analysis.roleOverlaps) {
    signals.push({
      id: `role_overlap_${overlap.roleA.uid}_${overlap.roleB.uid}`,
      level: overlap.overlapRatio >= 0.95 ? 'high' : 'medium',
      domain: overlap.roleA.domain,
      title: 'Sobreposição de cargos',
      detail: `"${overlap.roleA.label}" e "${overlap.roleB.label}" compartilham ${(overlap.overlapRatio * 100).toFixed(0)}% das permissões (${overlap.sharedPermissions.length} em comum). Considerar consolidação.`,
      affectedNodeUids: [overlap.roleA.uid, overlap.roleB.uid],
    });
  }

  // ── 4. Riscos operacionais ──
  for (const risk of analysis.operationalRisks) {
    signals.push({
      id: risk.id,
      level: risk.level,
      domain: 'platform_access',
      title: risk.title,
      detail: risk.detail,
      affectedNodeUids: risk.affectedUids,
    });
  }

  // ── 5. Orphan nodes ──
  if (analysis.orphanNodes.length > 0) {
    signals.push({
      id: 'orphan_nodes',
      level: 'medium',
      domain: analysis.orphanNodes[0].domain,
      title: 'Nós órfãos detectados',
      detail: `${analysis.orphanNodes.length} nó(s) sem conexão: ${analysis.orphanNodes.slice(0, 5).map(n => n.label).join(', ')}`,
      affectedNodeUids: analysis.orphanNodes.map(n => n.uid),
    });
  }

  // ── 6. Super admin count ──
  const superAdmins = Array.from(snapshot.nodes.values()).filter(
    n => n.type === 'role' && n.meta?.slug === 'platform_super_admin',
  );
  const superAdminUserCount = snapshot.edges.filter(
    e => (e.relation === 'HAS_ROLE' || e.relation === 'HAS_PLATFORM_ROLE') && superAdmins.some(sa => sa.uid === e.to),
  ).length;

  if (superAdminUserCount > MAX_SUPER_ADMINS) {
    signals.push({
      id: 'excess_super_admins',
      level: 'critical',
      domain: 'platform_access',
      title: 'Excesso de Super Admins',
      detail: `${superAdminUserCount} usuários com role Super Admin (máximo recomendado: ${MAX_SUPER_ADMINS}).`,
      affectedNodeUids: superAdmins.map(n => n.uid),
    });
  }

  // ── 7. Cross-domain users ──
  if (analysis.crossDomainUsers.length > 0) {
    signals.push({
      id: 'cross_domain_users',
      level: 'medium',
      domain: 'identity',
      title: 'Usuários multi-domínio',
      detail: `${analysis.crossDomainUsers.length} usuário(s) operam em Platform + Tenant simultaneamente. Verificar se MFA está habilitado.`,
      affectedNodeUids: analysis.crossDomainUsers.map(n => n.uid),
    });
  }

  // ── Determine overall level ──
  const overallLevel: RiskLevel = signals.some(s => s.level === 'critical')
    ? 'critical'
    : signals.some(s => s.level === 'high')
      ? 'high'
      : signals.some(s => s.level === 'medium')
        ? 'medium'
        : 'low';

  return {
    overallLevel,
    signals,
    assessedAt: Date.now(),
  };
}
