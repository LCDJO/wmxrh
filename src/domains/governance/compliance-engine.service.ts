/**
 * Compliance Engine — Evaluates rules against UGE data.
 *
 * READ-ONLY: Analyses graph state and reports violations.
 * Remediation suggestions are NON-DESTRUCTIVE (require confirmation).
 */

import { supabase } from '@/integrations/supabase/client';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type { UnifiedNode, UnifiedGraphSnapshot } from '@/domains/security/kernel/unified-graph-engine';
import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine';
import type {
  ComplianceRule,
  ComplianceRuleConfig,
  ComplianceViolation,
  ComplianceEvaluation,
  ComplianceReport,
} from './governance.types';

// ════════════════════════════════════
// BUILT-IN RULES
// ════════════════════════════════════

export const BUILT_IN_RULES: Omit<ComplianceRule, 'id' | 'tenant_id' | 'created_by' | 'created_at' | 'updated_at' | 'last_evaluated_at' | 'last_violation_count'>[] = [
  {
    rule_code: 'MAX_PERMISSIONS_PER_USER',
    name: 'Limite de Permissões por Usuário',
    description: 'Usuários não devem ter mais de N permissões resolvidas.',
    category: 'access_control',
    severity: 'warning',
    status: 'active',
    rule_config: { type: 'max_permissions', threshold: 25 },
    auto_remediate: false,
    remediation_action: 'Revisar e remover permissões desnecessárias.',
  },
  {
    rule_code: 'SUPER_ADMIN_LIMIT',
    name: 'Limite de Super Admins',
    description: 'No máximo N usuários com role de Super Admin.',
    category: 'access_control',
    severity: 'critical',
    status: 'active',
    rule_config: { type: 'super_admin_limit', threshold: 3 },
    auto_remediate: false,
    remediation_action: 'Reduzir número de super admins.',
  },
  {
    rule_code: 'ORPHAN_NODE_CHECK',
    name: 'Nós Órfãos no Grafo',
    description: 'Detectar cargos/permissões sem conexão.',
    category: 'identity_hygiene',
    severity: 'info',
    status: 'active',
    rule_config: { type: 'orphan_check' },
    auto_remediate: false,
    remediation_action: 'Remover ou conectar nós órfãos.',
  },
  {
    rule_code: 'ROLE_OVERLAP_THRESHOLD',
    name: 'Sobreposição de Cargos',
    description: 'Cargos com >80% de permissões compartilhadas devem ser consolidados.',
    category: 'identity_hygiene',
    severity: 'warning',
    status: 'active',
    rule_config: { type: 'role_overlap_threshold', threshold: 0.8 },
    auto_remediate: false,
    remediation_action: 'Consolidar cargos redundantes.',
  },
];

// ════════════════════════════════════
// SEED BUILT-IN RULES
// ════════════════════════════════════

export async function seedBuiltInRules(tenantId: string): Promise<void> {
  for (const rule of BUILT_IN_RULES) {
    await supabase
      .from('compliance_rules')
      .upsert(
        { ...rule, tenant_id: tenantId } as any,
        { onConflict: 'tenant_id,rule_code' },
      );
  }
}

// ════════════════════════════════════
// FETCH RULES
// ════════════════════════════════════

export async function fetchComplianceRules(tenantId: string): Promise<ComplianceRule[]> {
  const { data, error } = await supabase
    .from('compliance_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('severity', { ascending: false });

  if (error) throw new Error(`Failed to fetch rules: ${error.message}`);
  return (data ?? []) as unknown as ComplianceRule[];
}

// ════════════════════════════════════
// EVALUATE ALL
// ════════════════════════════════════

export async function evaluateCompliance(tenantId: string): Promise<ComplianceReport> {
  const rules = await fetchComplianceRules(tenantId);
  const report = unifiedGraphEngine.buildFullReport();
  const { snapshot, analysis, risk } = report;

  const evaluations: ComplianceEvaluation[] = [];

  for (const rule of rules) {
    const violations = evaluateRule(rule, snapshot, analysis);
    const passed = violations.length === 0;

    const evalRecord = {
      tenant_id: tenantId,
      rule_id: rule.id,
      passed,
      violation_count: violations.length,
      violations: violations as any,
      remediation_suggestions: [] as any,
      ai_analysis: null,
      evaluated_by: null,
    };

    const { data, error } = await supabase
      .from('compliance_evaluations')
      .insert(evalRecord)
      .select()
      .single();

    if (!error && data) {
      evaluations.push(data as unknown as ComplianceEvaluation);
    }

    // Update rule stats
    await supabase
      .from('compliance_rules')
      .update({
        last_evaluated_at: new Date().toISOString(),
        last_violation_count: violations.length,
      } as any)
      .eq('id', rule.id);
  }

  const failedEvals = evaluations.filter(e => !e.passed);
  const criticalViolations = failedEvals.filter(e => {
    const rule = rules.find(r => r.id === e.rule_id);
    return rule?.severity === 'critical';
  }).length;

  const passedCount = evaluations.filter(e => e.passed).length;
  const overallScore = rules.length > 0 ? Math.round((passedCount / rules.length) * 100) : 100;

  return {
    tenant_id: tenantId,
    evaluated_at: new Date().toISOString(),
    total_rules: rules.length,
    passed_count: passedCount,
    failed_count: failedEvals.length,
    critical_violations: criticalViolations,
    warning_violations: failedEvals.length - criticalViolations,
    info_violations: 0,
    evaluations,
    overall_score: overallScore,
    ai_summary: null,
  };
}

// ════════════════════════════════════
// RULE EVALUATOR
// ════════════════════════════════════

function evaluateRule(
  rule: ComplianceRule,
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
): ComplianceViolation[] {
  const config = rule.rule_config as ComplianceRuleConfig;
  const violations: ComplianceViolation[] = [];
  const allNodes: UnifiedNode[] = Array.from(snapshot.nodes.values());

  switch (config.type) {
    case 'max_permissions': {
      const threshold = config.threshold ?? 25;
      for (const ep of analysis.excessivePermissions) {
        if (ep.permissionCount > threshold) {
          violations.push({
            rule_code: rule.rule_code,
            rule_name: rule.name,
            severity: rule.severity,
            description: `Usuário "${ep.user.label}" possui ${ep.permissionCount} permissões (limite: ${threshold}).`,
            affected_entities: [{ uid: ep.user.uid, label: ep.user.label, type: ep.user.type }],
            remediation_hint: rule.remediation_action,
          });
        }
      }
      break;
    }

    case 'super_admin_limit': {
      const limit = config.threshold ?? 3;
      const superAdminRoles = allNodes.filter(
        n => n.type === 'role' && n.meta?.slug === 'platform_super_admin',
      );
      const superAdminUsers = snapshot.edges.filter(
        e => ['HAS_ROLE', 'HAS_PLATFORM_ROLE'].includes(e.relation) &&
          superAdminRoles.some(r => r.uid === e.to),
      );
      if (superAdminUsers.length > limit) {
        violations.push({
          rule_code: rule.rule_code,
          rule_name: rule.name,
          severity: rule.severity,
          description: `${superAdminUsers.length} super admins detectados (limite: ${limit}).`,
          affected_entities: superAdminUsers.map(e => {
            const n = snapshot.nodes.get(e.from);
            return { uid: e.from, label: n?.label ?? e.from, type: n?.type ?? 'unknown' };
          }),
          remediation_hint: rule.remediation_action,
        });
      }
      break;
    }

    case 'orphan_check': {
      if (analysis.orphanNodes.length > 0) {
        violations.push({
          rule_code: rule.rule_code,
          rule_name: rule.name,
          severity: rule.severity,
          description: `${analysis.orphanNodes.length} nó(s) órfão(s) detectado(s).`,
          affected_entities: analysis.orphanNodes.slice(0, 10).map(n => ({
            uid: n.uid, label: n.label, type: n.type,
          })),
          remediation_hint: rule.remediation_action,
        });
      }
      break;
    }

    case 'role_overlap_threshold': {
      const threshold = config.threshold ?? 0.8;
      for (const overlap of analysis.roleOverlaps) {
        if (overlap.overlapRatio >= threshold) {
          violations.push({
            rule_code: rule.rule_code,
            rule_name: rule.name,
            severity: rule.severity,
            description: `Cargos "${overlap.roleA.label}" e "${overlap.roleB.label}" compartilham ${Math.round(overlap.overlapRatio * 100)}% das permissões.`,
            affected_entities: [
              { uid: overlap.roleA.uid, label: overlap.roleA.label, type: 'role' },
              { uid: overlap.roleB.uid, label: overlap.roleB.label, type: 'role' },
            ],
            remediation_hint: rule.remediation_action,
          });
        }
      }
      break;
    }

    case 'sod_conflict': {
      for (const conflict of analysis.accessConflicts) {
        violations.push({
          rule_code: rule.rule_code,
          rule_name: rule.name,
          severity: rule.severity,
          description: `Conflito SoD: ${conflict.detail}`,
          affected_entities: [
            { uid: conflict.user.uid, label: conflict.user.label, type: conflict.user.type },
            ...conflict.roles.map(r => ({ uid: r.uid, label: r.label, type: 'role' })),
          ],
          remediation_hint: rule.remediation_action,
        });
      }
      break;
    }

    default:
      break;
  }

  return violations;
}
