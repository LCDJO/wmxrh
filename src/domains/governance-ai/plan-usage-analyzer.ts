/**
 * PlanUsageAnalyzer — Detects plan-tier waste.
 *
 * Identifies tenants on high-tier plans (Enterprise, Business)
 * that underutilize premium modules, generating governance
 * insights suggesting plan review or module activation.
 *
 * Data source: tenant_plans + saas_plans (via Supabase).
 * READ-ONLY — never mutates data.
 */

import { supabase } from '@/integrations/supabase/client';
import type { GovernanceInsight } from './types';
import { insightId } from './utils';

// ── Thresholds ──────────────────────────────────────────────────

/** Plans considered "premium" (case-insensitive tier match) */
const PREMIUM_TIERS = ['enterprise', 'business', 'professional'];

/** Minimum module count expected for premium plans */
const PREMIUM_MODULE_MIN = 3;

/** Usage ratio below which we flag waste (e.g. using <40% of included modules) */
const LOW_USAGE_RATIO = 0.4;

// ── Types ───────────────────────────────────────────────────────

interface TenantPlanRow {
  tenant_id: string;
  plan_id: string;
  status: string;
  saas_plans: {
    name: string;
    tier: string;
    included_modules: string[] | null;
    price_brl: number;
  } | null;
}

export interface PlanWasteSignal {
  tenant_id: string;
  plan_name: string;
  tier: string;
  included_modules: string[];
  active_modules: string[];
  usage_ratio: number;
  price_brl: number;
}

// ── Analyzer ────────────────────────────────────────────────────

/**
 * Fetch active premium plans and detect low module usage.
 */
export async function analyzePlanUsage(): Promise<GovernanceInsight[]> {
  const { data, error } = await supabase
    .from('tenant_plans')
    .select('tenant_id, plan_id, status, saas_plans(name, tier, included_modules, price_brl)')
    .eq('status', 'active');

  if (error || !data) {
    console.warn('[PlanUsageAnalyzer] Failed to fetch tenant plans:', error);
    return [];
  }

  const insights: GovernanceInsight[] = [];

  for (const row of data as unknown as TenantPlanRow[]) {
    const plan = row.saas_plans;
    if (!plan) continue;

    const tier = (plan.tier ?? '').toLowerCase();
    if (!PREMIUM_TIERS.includes(tier)) continue;

    const includedModules = plan.included_modules ?? [];
    if (includedModules.length < PREMIUM_MODULE_MIN) continue;

    // For now, estimate active modules from what modules the tenant has data for.
    // A more precise version would check module_orchestrator state.
    const activeModules = await getActiveTenantModules(row.tenant_id, includedModules);

    const usageRatio = includedModules.length > 0
      ? activeModules.length / includedModules.length
      : 1;

    if (usageRatio < LOW_USAGE_RATIO) {
      const signal: PlanWasteSignal = {
        tenant_id: row.tenant_id,
        plan_name: plan.name,
        tier: plan.tier,
        included_modules: includedModules,
        active_modules: activeModules,
        usage_ratio: Math.round(usageRatio * 100) / 100,
        price_brl: plan.price_brl,
      };

      insights.push(buildPlanWasteInsight(signal));
    }
  }

  return insights;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Estimate which included modules are actually being used by the tenant.
 * Checks for data presence in key tables associated with each module.
 */
async function getActiveTenantModules(
  tenantId: string,
  includedModules: string[],
): Promise<string[]> {
  const moduleChecks: Record<string, () => Promise<boolean>> = {
    payroll: async () => {
      const { count } = await supabase.from('employee_payroll_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
    benefits: async () => {
      const { count } = await supabase.from('employee_benefits').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
    health: async () => {
      const { count } = await supabase.from('employee_health_exams').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
    compliance: async () => {
      const { count } = await supabase.from('compliance_rules').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
    agreements: async () => {
      const { count } = await supabase.from('agreement_templates').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
    automation: async () => {
      const { count } = await supabase.from('automation_rules').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      return (count ?? 0) > 0;
    },
  };

  const active: string[] = [];

  const checks = includedModules.map(async (mod) => {
    const check = moduleChecks[mod.toLowerCase()];
    if (!check) return;
    const hasData = await check();
    if (hasData) active.push(mod);
  });

  await Promise.all(checks);
  return active;
}

function buildPlanWasteInsight(signal: PlanWasteSignal): GovernanceInsight {
  const unusedModules = signal.included_modules.filter(
    m => !signal.active_modules.includes(m),
  );

  return {
    id: insightId(),
    category: 'plan_waste',
    severity: signal.usage_ratio <= 0.2 ? 'critical' : 'warning',
    title: `Plano ${signal.plan_name} com baixo uso de módulos premium`,
    description: [
      `Tenant utiliza apenas ${signal.active_modules.length}/${signal.included_modules.length}`,
      `módulos incluídos no plano ${signal.plan_name} (${signal.tier}).`,
      `Módulos não utilizados: ${unusedModules.join(', ')}.`,
      `Taxa de uso: ${Math.round(signal.usage_ratio * 100)}%.`,
    ].join(' '),
    affected_entities: [
      { type: 'tenant', id: signal.tenant_id, label: `Tenant ${signal.tenant_id.slice(0, 8)}` },
    ],
    recommendation: [
      'Considerar:',
      '1) Ativar os módulos premium não utilizados para maximizar o valor do plano;',
      '2) Migrar para um plano inferior se os módulos premium não são necessários;',
      `3) Economia potencial ao fazer downgrade: R$ ${signal.price_brl}/ciclo.`,
    ].join(' '),
    auto_remediable: false,
    confidence: 0.85,
    detected_at: Date.now(),
    source: 'heuristic',
    metadata: {
      plan_name: signal.plan_name,
      tier: signal.tier,
      usage_ratio: signal.usage_ratio,
      included_modules: signal.included_modules,
      active_modules: signal.active_modules,
      unused_modules: unusedModules,
      price_brl: signal.price_brl,
    },
  };
}
