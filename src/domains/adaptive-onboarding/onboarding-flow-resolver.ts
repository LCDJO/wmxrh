/**
 * OnboardingFlowResolver — Determines the onboarding flow
 * based on plan tier, modules, and tenant context.
 */

import type {
  OnboardingFlow,
  OnboardingFlowResolverAPI,
  OnboardingPhase,
  OnboardingStep,
  TenantSetupConfig,
} from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Step Catalog ────────────────────────────────────────────────

const STEP_CATALOG: Omit<OnboardingStep, 'status'>[] = [
  // Welcome
  {
    id: 'welcome',
    phase: 'welcome',
    order: 0,
    title: 'Bem-vindo ao sistema',
    description: 'Conheça as principais funcionalidades disponíveis no seu plano.',
    icon: 'Sparkles',
    is_mandatory: true,
    estimated_minutes: 2,
    depends_on: [],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },
  // Company Setup
  {
    id: 'create_company',
    phase: 'company_setup',
    order: 1,
    title: 'Cadastrar Empresa',
    description: 'Adicione os dados da empresa principal (CNPJ, razão social, endereço).',
    icon: 'Building2',
    is_mandatory: true,
    estimated_minutes: 5,
    route: '/companies',
    depends_on: ['welcome'],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },
  {
    id: 'setup_departments',
    phase: 'company_setup',
    order: 2,
    title: 'Criar Departamentos',
    description: 'Organize a estrutura departamental da empresa.',
    icon: 'FolderTree',
    is_mandatory: false,
    estimated_minutes: 5,
    route: '/departments',
    depends_on: ['create_company'],
    applies_to_tiers: ['starter', 'professional', 'enterprise', 'custom'],
  },
  // Role Setup
  {
    id: 'configure_roles',
    phase: 'role_setup',
    order: 3,
    title: 'Configurar Papéis',
    description: 'Defina os papéis e permissões iniciais do sistema.',
    icon: 'Shield',
    is_mandatory: true,
    estimated_minutes: 10,
    route: '/settings/roles',
    depends_on: ['create_company'],
    applies_to_tiers: ['starter', 'professional', 'enterprise', 'custom'],
  },
  // Module Activation
  {
    id: 'activate_modules',
    phase: 'module_activation',
    order: 4,
    title: 'Ativar Módulos',
    description: 'Escolha quais módulos deseja ativar para sua organização.',
    icon: 'Puzzle',
    is_mandatory: false,
    estimated_minutes: 5,
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
  },
  // Team Invite
  {
    id: 'invite_users',
    phase: 'team_invite',
    order: 5,
    title: 'Convidar Equipe',
    description: 'Adicione outros administradores e gestores.',
    icon: 'UserPlus',
    is_mandatory: false,
    estimated_minutes: 5,
    route: '/settings/users',
    depends_on: ['configure_roles'],
    applies_to_tiers: ['starter', 'professional', 'enterprise', 'custom'],
  },
  // Compliance Check
  {
    id: 'compliance_check',
    phase: 'compliance_check',
    order: 6,
    title: 'Verificar Compliance',
    description: 'Revise as obrigações trabalhistas e de saúde ocupacional.',
    icon: 'ClipboardCheck',
    is_mandatory: true,
    estimated_minutes: 10,
    route: '/compliance',
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
  },
  {
    id: 'add_employees',
    phase: 'compliance_check',
    order: 7,
    title: 'Cadastrar Colaboradores',
    description: 'Adicione os primeiros colaboradores ao sistema.',
    icon: 'Users',
    is_mandatory: true,
    estimated_minutes: 15,
    route: '/employees',
    depends_on: ['create_company'],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },
  // Review
  {
    id: 'review',
    phase: 'review',
    order: 8,
    title: 'Revisão Final',
    description: 'Revise as configurações e comece a usar o sistema.',
    icon: 'CheckCircle',
    is_mandatory: true,
    estimated_minutes: 2,
    depends_on: [],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },
];

export function createOnboardingFlowResolver(): OnboardingFlowResolverAPI {
  return {
    resolveFlow(tenantId: string, planTier: PlanTier, _config?: TenantSetupConfig): OnboardingFlow {
      const applicableSteps = STEP_CATALOG
        .filter(s => s.applies_to_tiers.includes(planTier))
        .map(s => ({ ...s, status: 'pending' as const }));

      const phases: OnboardingPhase[] = [
        'welcome', 'company_setup', 'role_setup',
        'module_activation', 'team_invite', 'compliance_check', 'review',
      ];

      const firstPhase = applicableSteps.length > 0 ? applicableSteps[0].phase : 'welcome';

      return {
        tenant_id: tenantId,
        plan_tier: planTier,
        steps: applicableSteps,
        current_phase: firstPhase,
        completion_pct: 0,
        estimated_total_minutes: applicableSteps.reduce((sum, s) => sum + s.estimated_minutes, 0),
        started_at: Date.now(),
        completed_at: null,
      };
    },

    getStepsForPhase(flow: OnboardingFlow, phase: OnboardingPhase): OnboardingStep[] {
      return flow.steps.filter(s => s.phase === phase);
    },

    getNextStep(flow: OnboardingFlow): OnboardingStep | null {
      const pending = flow.steps.filter(s => s.status === 'pending');
      const ready = pending.filter(s =>
        s.depends_on.every(dep =>
          flow.steps.find(d => d.id === dep)?.status === 'completed' ||
          flow.steps.find(d => d.id === dep)?.status === 'skipped'
        )
      );
      return ready[0] ?? null;
    },
  };
}
