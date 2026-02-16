/**
 * TenantSetupOrchestrator — Orchestrates full tenant bootstrap:
 *   1. Suggest TenantAdmin creation
 *   2. Bootstrap default roles for the plan
 *   3. Register plan modules
 *   4. Generate initial dashboard config
 *
 * All actions are SUGGESTIVE — nothing is written without confirmation.
 */

import type { TenantSetupOrchestratorAPI, TenantSetupConfig, TenantSetupResult } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';
import { createRoleBootstrapper } from './role-bootstrapper';
import { createModuleSetupWizard } from './module-setup-wizard';

// ── Industry → Department mapping ────────────────────────────────

const INDUSTRY_DEPARTMENTS: Record<string, string[]> = {
  default: ['Administrativo', 'Recursos Humanos', 'Financeiro', 'Operações'],
  commerce: ['Administrativo', 'Vendas', 'Estoque', 'RH', 'Financeiro'],
  industry: ['Administrativo', 'Produção', 'Qualidade', 'RH', 'Manutenção', 'Logística'],
  services: ['Administrativo', 'Operações', 'Comercial', 'RH', 'TI'],
  construction: ['Administrativo', 'Obras', 'Segurança do Trabalho', 'RH', 'Compras'],
  healthcare: ['Administrativo', 'Assistencial', 'RH', 'Faturamento', 'Qualidade'],
};

// ── Plan → Compliance requirements ───────────────────────────────

const PLAN_COMPLIANCE: Record<PlanTier, string[]> = {
  free: ['Cadastro de empresa obrigatório'],
  starter: ['Cadastro de empresa', 'eSocial básico'],
  professional: ['eSocial completo', 'PCMSO', 'PGR', 'NRs aplicáveis'],
  enterprise: ['eSocial completo', 'PCMSO', 'PGR', 'NRs', 'LGPD', 'Auditoria'],
  custom: ['Customizado por contrato'],
};

// ── Plan → Default dashboard widgets ─────────────────────────────

export interface DashboardWidget {
  key: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'alert';
  module: string;
}

const DASHBOARD_WIDGETS: (DashboardWidget & { min_tier: PlanTier })[] = [
  { key: 'total_employees', title: 'Total de Colaboradores', type: 'stat', module: 'employees', min_tier: 'free' },
  { key: 'active_companies', title: 'Empresas Ativas', type: 'stat', module: 'companies', min_tier: 'free' },
  { key: 'pending_docs', title: 'Documentos Pendentes', type: 'stat', module: 'employees', min_tier: 'starter' },
  { key: 'salary_overview', title: 'Visão Salarial', type: 'chart', module: 'compensation', min_tier: 'starter' },
  { key: 'compliance_alerts', title: 'Alertas de Compliance', type: 'alert', module: 'compliance', min_tier: 'professional' },
  { key: 'esocial_status', title: 'Status eSocial', type: 'list', module: 'esocial', min_tier: 'professional' },
  { key: 'health_exams_due', title: 'Exames a Vencer', type: 'list', module: 'health', min_tier: 'professional' },
  { key: 'workforce_kpis', title: 'KPIs Workforce', type: 'chart', module: 'intelligence', min_tier: 'enterprise' },
  { key: 'cost_projection', title: 'Projeção de Custos', type: 'chart', module: 'intelligence', min_tier: 'enterprise' },
  { key: 'audit_recent', title: 'Auditoria Recente', type: 'list', module: 'audit', min_tier: 'enterprise' },
];

const TIER_ORDER: Record<PlanTier, number> = { free: 0, starter: 1, professional: 2, enterprise: 3, custom: 4 };

// ── Extended result type ─────────────────────────────────────────

export interface FullTenantSetupResult extends TenantSetupResult {
  admin_role_suggested: { name: string; slug: string; permissions: string[] };
  roles_suggested: { name: string; slug: string; permissions: string[] }[];
  modules_to_activate: string[];
  dashboard_widgets: DashboardWidget[];
}

// ── Orchestrator ─────────────────────────────────────────────────

export function createTenantSetupOrchestrator(): TenantSetupOrchestratorAPI & {
  fullSetup(planTier: PlanTier, config: TenantSetupConfig): FullTenantSetupResult;
} {
  const roleBootstrapper = createRoleBootstrapper();
  const moduleWizard = createModuleSetupWizard();

  return {
    // Legacy simple API
    suggestSetup(planTier: PlanTier, config: TenantSetupConfig): TenantSetupResult {
      const industry = config.industry ?? 'default';
      const departments = INDUSTRY_DEPARTMENTS[industry] ?? INDUSTRY_DEPARTMENTS.default;

      return {
        tenant_id: '',
        company_created: false,
        departments_suggested: departments,
        compliance_requirements: PLAN_COMPLIANCE[planTier] ?? [],
      };
    },

    // Full orchestration pipeline
    fullSetup(planTier: PlanTier, config: TenantSetupConfig): FullTenantSetupResult {
      const industry = config.industry ?? 'default';
      const departments = INDUSTRY_DEPARTMENTS[industry] ?? INDUSTRY_DEPARTMENTS.default;

      // 1. Admin role
      const adminRole = {
        name: 'Administrador do Tenant',
        slug: 'tenant_admin',
        permissions: [
          'tenant.manage',
          'employees.read', 'employees.write',
          'companies.read', 'companies.write',
          'departments.read', 'departments.write',
          'roles.read', 'roles.write',
          'iam.read', 'iam.write',
          'audit.read',
        ],
      };

      // 2. Roles for the plan
      const rolePlan = roleBootstrapper.suggestRoles(planTier);
      const roles = rolePlan.roles.map(r => ({
        name: r.name,
        slug: r.slug,
        permissions: r.permissions,
      }));

      // 3. Modules to activate
      const recommended = moduleWizard.getRecommendedModules(planTier);
      const modulesToActivate = recommended.map(m => m.module_key as string);

      // 4. Dashboard widgets
      const tierLevel = TIER_ORDER[planTier] ?? 0;
      const widgets: DashboardWidget[] = DASHBOARD_WIDGETS
        .filter(w => TIER_ORDER[w.min_tier] <= tierLevel)
        .map(({ min_tier: _, ...rest }) => rest);

      return {
        tenant_id: '',
        company_created: false,
        departments_suggested: departments,
        compliance_requirements: PLAN_COMPLIANCE[planTier] ?? [],
        admin_role_suggested: adminRole,
        roles_suggested: roles,
        modules_to_activate: modulesToActivate,
        dashboard_widgets: widgets,
      };
    },
  };
}
