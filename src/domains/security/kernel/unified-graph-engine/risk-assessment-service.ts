/**
 * RiskAssessmentService — Evaluates governance risks from the unified graph.
 *
 * Risk signals:
 *   - Privilege concentration (one user with too many permissions)
 *   - Orphan roles (roles assigned to nobody)
 *   - Cross-domain identity without MFA
 *   - Super admin count exceeding threshold
 *   - Unused permissions
 */

import type {
  UnifiedGraphSnapshot,
  RiskAssessment,
  RiskSignal,
  RiskLevel,
} from './types';
import { analyzeGraph } from './graph-analyzer';

const MAX_SUPER_ADMINS = 3;
const MAX_PERMISSIONS_PER_USER = 30;

export function assessRisk(snapshot: UnifiedGraphSnapshot): RiskAssessment {
  const analysis = analyzeGraph(snapshot);
  const signals: RiskSignal[] = [];

  // ── 1. Orphan nodes ──
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

  // ── 2. Privilege concentration ──
  for (const { node, edgeCount } of analysis.highFanOutNodes) {
    if ((node.type === 'platform_user' || node.type === 'tenant_user') && edgeCount > MAX_PERMISSIONS_PER_USER) {
      signals.push({
        id: `privilege_concentration_${node.uid}`,
        level: 'high',
        domain: node.domain,
        title: 'Concentração de privilégios',
        detail: `Usuário "${node.label}" possui ${edgeCount} conexões diretas — avaliar princípio do menor privilégio.`,
        affectedNodeUids: [node.uid],
      });
    }
  }

  // ── 3. Super admin count ──
  const superAdmins = Array.from(snapshot.nodes.values()).filter(
    n => n.type === 'role' && n.meta?.slug === 'platform_super_admin',
  );
  // Count users linked to super admin role
  const superAdminUserCount = snapshot.edges.filter(
    e => e.relation === 'HAS_PLATFORM_ROLE' && superAdmins.some(sa => sa.uid === e.to),
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

  // ── 4. Cross-domain users without explicit governance ──
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
