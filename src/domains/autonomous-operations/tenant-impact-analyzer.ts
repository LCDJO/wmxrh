/**
 * TenantImpactAnalyzer — Pre-deploy impact assessment for platform releases.
 *
 * Before deploy, evaluates:
 *  - Quantos tenants serão afetados
 *  - Impacto em automações (workflows quebrando, degradados)
 *  - Impacto em billing (MRR em risco, mudanças de plano/preço)
 *
 * Also provides per-tenant health reports (existing functionality).
 */

import type {
  TenantImpactReport,
  DeployImpactAssessment,
  TenantDeployImpact,
  AutomationImpact,
  BillingImpact,
} from './types';
import { RiskPredictionService } from './risk-prediction-service';
import { RevenueOptimizationAdvisor } from './revenue-optimization-advisor';

const now = () => new Date().toISOString();

// ══════════════════════════════════════════════
// Deploy impact assessment inputs
// ══════════════════════════════════════════════

export interface DeployManifest {
  release_id: string;
  release_label: string;
  /** Modules being changed in this release */
  changed_modules: string[];
  /** Whether this includes breaking API changes */
  has_breaking_api_changes: boolean;
  /** Whether billing rules/plans are changing */
  billing_changes: boolean;
  /** New pricing deltas per plan (plan_id → delta BRL) */
  pricing_deltas?: Record<string, number>;
  /** Deprecated features being removed */
  deprecated_features?: string[];
}

export interface TenantSnapshot {
  tenant_id: string;
  tenant_name: string;
  plan: string;
  mrr: number;
  active_modules: string[];
  active_workflows: number;
  active_automations: number;
  /** Workflows that depend on changed modules */
  workflows_using_modules: Record<string, string[]>;
}

// ══════════════════════════════════════════════
// Core assessment logic
// ══════════════════════════════════════════════

function assessTenantImpact(
  tenant: TenantSnapshot,
  manifest: DeployManifest,
): TenantDeployImpact {
  const affectedModules = tenant.active_modules.filter(m =>
    manifest.changed_modules.includes(m),
  );

  // Count workflows that touch changed modules
  let affectedWorkflows = 0;
  for (const mod of manifest.changed_modules) {
    affectedWorkflows += (tenant.workflows_using_modules[mod] ?? []).length;
  }

  // Automations affected = workflows + any deprecated features
  const deprecatedHits = (manifest.deprecated_features ?? []).filter(f =>
    tenant.active_modules.includes(f),
  ).length;
  const affectedAutomations = affectedWorkflows + deprecatedHits;

  // Billing change
  const billingChange = manifest.pricing_deltas?.[tenant.plan] ?? 0;

  // Risk factors
  const riskFactors: string[] = [];
  if (affectedModules.length > 3) riskFactors.push('Muitos módulos afetados simultaneamente');
  if (manifest.has_breaking_api_changes && affectedModules.length > 0) riskFactors.push('API breaking change em módulos ativos');
  if (deprecatedHits > 0) riskFactors.push(`${deprecatedHits} feature(s) deprecada(s) em uso`);
  if (billingChange > 0) riskFactors.push(`Aumento de R$${billingChange.toFixed(2)}/mês`);
  if (affectedWorkflows > 5) riskFactors.push(`${affectedWorkflows} workflows afetados`);

  // Impact level
  let impactLevel: TenantDeployImpact['impact_level'] = 'none';
  if (affectedModules.length === 0 && billingChange === 0) {
    impactLevel = 'none';
  } else if (manifest.has_breaking_api_changes && affectedModules.length > 0) {
    impactLevel = deprecatedHits > 0 ? 'critical' : 'high';
  } else if (affectedWorkflows > 3 || billingChange > 50) {
    impactLevel = 'high';
  } else if (affectedModules.length > 0) {
    impactLevel = 'medium';
  } else {
    impactLevel = 'low';
  }

  return {
    tenant_id: tenant.tenant_id,
    tenant_name: tenant.tenant_name,
    plan: tenant.plan,
    impact_level: impactLevel,
    affected_modules: affectedModules,
    affected_workflows: affectedWorkflows,
    affected_automations: affectedAutomations,
    billing_change_brl: billingChange,
    risk_factors: riskFactors,
  };
}

function assessAutomationImpact(
  tenantImpacts: TenantDeployImpact[],
  manifest: DeployManifest,
): AutomationImpact {
  const totalAffected = tenantImpacts.reduce((s, t) => s + t.affected_workflows, 0);
  const breaking = manifest.has_breaking_api_changes
    ? tenantImpacts.filter(t => t.affected_workflows > 0 && t.impact_level === 'critical').length
    : 0;
  const degraded = tenantImpacts.filter(
    t => t.affected_workflows > 0 && t.impact_level !== 'critical' && t.impact_level !== 'none',
  ).length;

  const breakingDetails: { workflow_name: string; reason: string }[] = [];
  if (manifest.has_breaking_api_changes) {
    for (const mod of manifest.changed_modules) {
      breakingDetails.push({
        workflow_name: `Workflows usando ${mod}`,
        reason: `Módulo "${mod}" possui breaking changes na API`,
      });
    }
  }
  for (const feat of manifest.deprecated_features ?? []) {
    breakingDetails.push({
      workflow_name: `Automações usando ${feat}`,
      reason: `Feature "${feat}" será removida neste release`,
    });
  }

  return {
    total_workflows_affected: totalAffected,
    workflows_breaking: breaking,
    workflows_degraded: degraded,
    workflows_unaffected: Math.max(0, totalAffected - breaking - degraded),
    breaking_details: breakingDetails,
  };
}

function assessBillingImpact(
  tenantImpacts: TenantDeployImpact[],
  manifest: DeployManifest,
): BillingImpact {
  const withPriceChange = tenantImpacts.filter(t => t.billing_change_brl !== 0);
  const totalDelta = withPriceChange.reduce((s, t) => s + t.billing_change_brl, 0);
  const mrrAtRisk = tenantImpacts
    .filter(t => t.impact_level === 'critical' || t.impact_level === 'high')
    .length * 200; // estimated avg MRR per affected tenant

  const details: string[] = [];
  if (manifest.billing_changes) details.push('Regras de billing atualizadas neste release');
  if (withPriceChange.length > 0) details.push(`${withPriceChange.length} tenant(s) com alteração de preço`);
  if (totalDelta > 0) details.push(`Receita estimada: +R$${totalDelta.toFixed(2)}/mês`);
  if (totalDelta < 0) details.push(`Receita estimada: -R$${Math.abs(totalDelta).toFixed(2)}/mês`);

  return {
    total_mrr_at_risk: mrrAtRisk,
    tenants_with_price_change: withPriceChange.length,
    tenants_with_plan_change: manifest.billing_changes ? withPriceChange.length : 0,
    estimated_revenue_delta_brl: totalDelta,
    details,
  };
}

function resolveVerdict(
  tenantImpacts: TenantDeployImpact[],
  automation: AutomationImpact,
  billing: BillingImpact,
): { verdict: DeployImpactAssessment['verdict']; reason: string } {
  const criticalCount = tenantImpacts.filter(t => t.impact_level === 'critical').length;
  const highCount = tenantImpacts.filter(t => t.impact_level === 'high').length;

  if (criticalCount > 3 || automation.workflows_breaking > 5) {
    return { verdict: 'blocked', reason: `${criticalCount} tenants com impacto crítico e ${automation.workflows_breaking} workflows quebrando. Deploy bloqueado — requer revisão.` };
  }
  if (criticalCount > 0 || automation.workflows_breaking > 0) {
    return { verdict: 'risky', reason: `${criticalCount} tenant(s) com impacto crítico. Recomendado: deploy canário com monitoramento ativo.` };
  }
  if (highCount > 2 || billing.total_mrr_at_risk > 1000) {
    return { verdict: 'caution', reason: `${highCount} tenant(s) com impacto alto e R$${billing.total_mrr_at_risk.toFixed(2)} MRR em risco. Deploy com cautela.` };
  }
  return { verdict: 'safe', reason: 'Impacto baixo ou nulo em todos os tenants. Deploy seguro.' };
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

export const TenantImpactAnalyzer = {
  /** Per-tenant health report (existing) */
  analyze(tenantId: string, tenantName: string): TenantImpactReport {
    const risks = RiskPredictionService.predict([]);
    const optimizations = RevenueOptimizationAdvisor.analyze([
      { tenant_id: tenantId, tenant_name: tenantName, current_plan: 'professional', mrr: 499, usage_pct: 60, active_modules: 6, total_modules: 13, months_active: 6, churn_risk_score: 30 },
    ]);

    return {
      tenant_id: tenantId,
      tenant_name: tenantName,
      health_score: 85 + Math.round(Math.random() * 15),
      risk_score: Math.round(Math.random() * 30),
      usage_trend: 'growing',
      active_incidents: 0,
      predicted_risks: risks,
      optimizations,
      last_analyzed: now(),
    };
  },

  /** Batch analyze all known tenants (preview mode) */
  batchAnalyze(): TenantImpactReport[] {
    const tenants = [
      { id: 't1', name: 'Empresa Alpha' },
      { id: 't2', name: 'Corp Beta' },
      { id: 't3', name: 'Grupo Gamma' },
    ];
    return tenants.map(t => TenantImpactAnalyzer.analyze(t.id, t.name));
  },

  /**
   * PRE-DEPLOY IMPACT ASSESSMENT
   * Evaluates a release manifest against tenant snapshots to determine:
   * - Quantos tenants serão afetados
   * - Impacto em automações (workflows quebrando/degradados)
   * - Impacto em billing (MRR em risco, mudanças de preço)
   */
  assessDeploy(
    manifest: DeployManifest,
    tenants: TenantSnapshot[],
  ): DeployImpactAssessment {
    const tenantImpacts = tenants.map(t => assessTenantImpact(t, manifest));
    const automation = assessAutomationImpact(tenantImpacts, manifest);
    const billing = assessBillingImpact(tenantImpacts, manifest);
    const { verdict, reason } = resolveVerdict(tenantImpacts, automation, billing);

    const breakdown = {
      critical: tenantImpacts.filter(t => t.impact_level === 'critical').length,
      high: tenantImpacts.filter(t => t.impact_level === 'high').length,
      medium: tenantImpacts.filter(t => t.impact_level === 'medium').length,
      low: tenantImpacts.filter(t => t.impact_level === 'low').length,
      none: tenantImpacts.filter(t => t.impact_level === 'none').length,
    };

    return {
      release_id: manifest.release_id,
      release_label: manifest.release_label,
      analyzed_at: now(),
      total_tenants_affected: tenants.length - breakdown.none,
      impact_breakdown: breakdown,
      tenant_impacts: tenantImpacts,
      automation_impact: automation,
      billing_impact: billing,
      verdict,
      verdict_reason: reason,
    };
  },

  /** Preview with mock data */
  assessDeployPreview(): DeployImpactAssessment {
    const manifest: DeployManifest = {
      release_id: 'rel_2026_02_19',
      release_label: 'v2.14.0 — Payroll Engine Overhaul',
      changed_modules: ['payroll_sim', 'compensation', 'compliance'],
      has_breaking_api_changes: true,
      billing_changes: true,
      pricing_deltas: { starter: 0, professional: 29.90, enterprise: 0 },
      deprecated_features: ['legacy_payroll_export'],
    };

    const tenants: TenantSnapshot[] = [
      {
        tenant_id: 't1', tenant_name: 'Empresa Alpha', plan: 'professional', mrr: 499,
        active_modules: ['employees', 'payroll_sim', 'compensation', 'compliance', 'benefits'],
        active_workflows: 12, active_automations: 8,
        workflows_using_modules: { payroll_sim: ['Cálculo Mensal', 'Simulação'], compensation: ['Reajuste Salarial'], compliance: ['Audit Check'] },
      },
      {
        tenant_id: 't2', tenant_name: 'Corp Beta', plan: 'starter', mrr: 199,
        active_modules: ['employees', 'benefits'],
        active_workflows: 3, active_automations: 1,
        workflows_using_modules: {},
      },
      {
        tenant_id: 't3', tenant_name: 'Grupo Gamma', plan: 'professional', mrr: 799,
        active_modules: ['employees', 'payroll_sim', 'compensation', 'compliance', 'health', 'departments'],
        active_workflows: 18, active_automations: 14,
        workflows_using_modules: { payroll_sim: ['Folha Completa', 'Provisões', 'GFIP'], compensation: ['Bonus Anual'], compliance: ['NR Check', 'eSocial Sync'] },
      },
      {
        tenant_id: 't4', tenant_name: 'Startup Delta', plan: 'enterprise', mrr: 1299,
        active_modules: ['employees', 'payroll_sim', 'legacy_payroll_export'],
        active_workflows: 6, active_automations: 4,
        workflows_using_modules: { payroll_sim: ['Custom Export'] },
      },
    ];

    return TenantImpactAnalyzer.assessDeploy(manifest, tenants);
  },
};
