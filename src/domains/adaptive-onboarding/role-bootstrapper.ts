/**
 * RoleBootstrapper — Suggests initial roles based on plan tier.
 *
 * Basic/Free/Starter → RH + Gestor
 * Professional       → + RH Manager + Finance
 * Enterprise/Custom  → + HR Admin + Finance Admin + Operations
 */

import type { RoleBootstrapperAPI, RoleBootstrapPlan, BootstrapRole } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Basic roles (all plans) ─────────────────────────────────────

const BASIC_ROLES: BootstrapRole[] = [
  {
    name: 'RH',
    slug: 'rh',
    description: 'Acesso operacional a cadastro de colaboradores, cargos e departamentos.',
    permissions: [
      'employees.read', 'employees.write',
      'departments.read',
      'positions.read',
      'benefits.read',
    ],
    is_recommended: true,
  },
  {
    name: 'Gestor',
    slug: 'gestor',
    description: 'Visualiza e gerencia sua equipe e departamento.',
    permissions: [
      'employees.read',
      'departments.read', 'departments.write',
      'positions.read',
    ],
    is_recommended: true,
  },
];

// ── Professional roles ──────────────────────────────────────────

const PRO_ROLES: BootstrapRole[] = [
  {
    name: 'RH Manager',
    slug: 'rh_manager',
    description: 'Gestão completa de RH incluindo remuneração, compliance e saúde ocupacional.',
    permissions: [
      'employees.read', 'employees.write',
      'salary.read', 'salary.write',
      'benefits.read', 'benefits.write',
      'compliance.read', 'compliance.write',
      'health.read',
      'esocial.read',
      'departments.read', 'departments.write',
      'positions.read', 'positions.write',
    ],
    is_recommended: true,
  },
  {
    name: 'Finance',
    slug: 'finance',
    description: 'Acesso a informações financeiras, folha e benefícios.',
    permissions: [
      'salary.read',
      'benefits.read',
      'employees.read',
      'payroll.read',
    ],
    is_recommended: true,
  },
];

// ── Enterprise roles ────────────────────────────────────────────

const ENTERPRISE_ROLES: BootstrapRole[] = [
  {
    name: 'HR Admin',
    slug: 'hr_admin',
    description: 'Administração total de RH com controle de IAM, auditoria e inteligência.',
    permissions: [
      'employees.read', 'employees.write',
      'salary.read', 'salary.write',
      'benefits.read', 'benefits.write',
      'compliance.read', 'compliance.write',
      'health.read', 'health.write',
      'esocial.read', 'esocial.write',
      'departments.read', 'departments.write',
      'positions.read', 'positions.write',
      'iam.read', 'iam.write',
      'audit.read',
      'intelligence.read',
    ],
    is_recommended: true,
  },
  {
    name: 'Finance Admin',
    slug: 'finance_admin',
    description: 'Administração financeira com acesso a folha, projeções e relatórios estratégicos.',
    permissions: [
      'salary.read', 'salary.write',
      'benefits.read', 'benefits.write',
      'payroll.read', 'payroll.write',
      'intelligence.read',
      'employees.read',
    ],
    is_recommended: true,
  },
  {
    name: 'Operations',
    slug: 'operations',
    description: 'Gestão operacional com visão de compliance, treinamentos e segurança do trabalho.',
    permissions: [
      'employees.read',
      'departments.read', 'departments.write',
      'compliance.read',
      'health.read',
      'training.read', 'training.write',
      'audit.read',
    ],
    is_recommended: true,
  },
];

// ── Tier reasons ────────────────────────────────────────────────

const TIER_REASONS: Record<PlanTier, string> = {
  free: 'Papéis básicos: RH operacional e Gestor de equipe.',
  starter: 'Papéis básicos para equipe pequena com gestão departamental.',
  professional: 'Papéis com separação entre gestão de RH e financeiro.',
  enterprise: 'Papéis com governança completa: HR Admin, Finance Admin e Operations.',
  custom: 'Papéis customizados conforme contrato.',
};

// ── Factory ─────────────────────────────────────────────────────

export function createRoleBootstrapper(): RoleBootstrapperAPI {
  return {
    suggestRoles(planTier: PlanTier): RoleBootstrapPlan {
      let roles = [...BASIC_ROLES];

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
