/**
 * RoleBootstrapper — Suggests initial roles based on plan tier.
 */

import type { RoleBootstrapperAPI, RoleBootstrapPlan, BootstrapRole } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

const BASE_ROLES: BootstrapRole[] = [
  {
    name: 'Administrador RH',
    slug: 'admin_rh',
    description: 'Acesso completo a RH, folha e benefícios.',
    permissions: ['employees.read', 'employees.write', 'salary.read', 'salary.write', 'benefits.read', 'benefits.write'],
    is_recommended: true,
  },
  {
    name: 'Gestor Departamental',
    slug: 'gestor_depto',
    description: 'Visualiza colaboradores e gerencia seu departamento.',
    permissions: ['employees.read', 'departments.read', 'departments.write'],
    is_recommended: true,
  },
];

const PRO_ROLES: BootstrapRole[] = [
  {
    name: 'Analista de Compliance',
    slug: 'analista_compliance',
    description: 'Acesso a módulos de compliance, eSocial e saúde ocupacional.',
    permissions: ['compliance.read', 'compliance.write', 'health.read', 'esocial.read'],
    is_recommended: true,
  },
  {
    name: 'Auditor',
    slug: 'auditor',
    description: 'Acesso somente leitura a logs e auditoria.',
    permissions: ['audit.read', 'employees.read', 'compliance.read'],
    is_recommended: false,
  },
];

const ENTERPRISE_ROLES: BootstrapRole[] = [
  {
    name: 'Diretor Estratégico',
    slug: 'diretor_estrategico',
    description: 'Acesso a dashboards de inteligência e indicadores estratégicos.',
    permissions: ['dashboard.read', 'intelligence.read', 'salary.read', 'compliance.read'],
    is_recommended: true,
  },
  {
    name: 'Operador de Segurança',
    slug: 'operador_seguranca',
    description: 'Gerencia configurações de segurança e IAM.',
    permissions: ['iam.read', 'iam.write', 'audit.read', 'security.read'],
    is_recommended: false,
  },
];

const TIER_REASONS: Record<PlanTier, string> = {
  free: 'Papéis básicos para operação mínima.',
  starter: 'Papéis recomendados para equipe pequena.',
  professional: 'Papéis com separação de compliance e operação.',
  enterprise: 'Papéis com governança, auditoria e segurança.',
  custom: 'Papéis customizados conforme contrato.',
};

export function createRoleBootstrapper(): RoleBootstrapperAPI {
  return {
    suggestRoles(planTier: PlanTier): RoleBootstrapPlan {
      let roles = [...BASE_ROLES];

      if (['professional', 'enterprise', 'custom'].includes(planTier)) {
        roles = [...roles, ...PRO_ROLES];
      }
      if (['enterprise', 'custom'].includes(planTier)) {
        roles = [...roles, ...ENTERPRISE_ROLES];
      }

      return {
        plan_tier: planTier,
        roles,
        reason: TIER_REASONS[planTier] ?? TIER_REASONS.custom,
      };
    },
  };
}
