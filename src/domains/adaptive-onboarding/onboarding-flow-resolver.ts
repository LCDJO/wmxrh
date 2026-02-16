/**
 * OnboardingFlowResolver — Determines the onboarding flow
 * based on plan tier, allowed modules, user role, and tenant context.
 *
 * RESOLUTION LOGIC:
 *   1. Filter steps by plan tier (applies_to_tiers)
 *   2. Filter by allowed modules (requires_modules ⊆ allowedModules)
 *   3. Filter by user role (allowed_roles includes userRole)
 *   4. Sort by order, resolve dependencies
 */

import type {
  OnboardingFlow,
  OnboardingFlowResolverAPI,
  OnboardingPhase,
  OnboardingStep,
  FlowResolverContext,
} from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Step Catalog ────────────────────────────────────────────────

type StepDef = Omit<OnboardingStep, 'status'>;

const STEP_CATALOG: StepDef[] = [
  // ═══ WELCOME ═══
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

  // ═══ COMPANY SETUP ═══
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
  {
    id: 'setup_company_groups',
    phase: 'company_setup',
    order: 2,
    title: 'Configurar Grupos Econômicos',
    description: 'Organize múltiplas empresas em grupos econômicos para gestão centralizada.',
    icon: 'Network',
    is_mandatory: false,
    estimated_minutes: 10,
    route: '/groups',
    depends_on: ['create_company'],
    applies_to_tiers: ['enterprise', 'custom'],
    allowed_roles: ['tenant_admin', 'owner'],
  },

  // ═══ ROLE SETUP ═══
  {
    id: 'configure_roles_basic',
    phase: 'role_setup',
    order: 3,
    title: 'Configurar Cargos',
    description: 'Defina os cargos da empresa (CLT, estagiário, etc.).',
    icon: 'Briefcase',
    is_mandatory: true,
    estimated_minutes: 5,
    route: '/positions',
    depends_on: ['create_company'],
    applies_to_tiers: ['free', 'starter'],
  },
  {
    id: 'configure_roles',
    phase: 'role_setup',
    order: 3,
    title: 'Configurar Papéis e Permissões',
    description: 'Defina papéis com controle granular de permissões, escopos e hierarquias.',
    icon: 'Shield',
    is_mandatory: true,
    estimated_minutes: 15,
    route: '/settings/roles',
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
    allowed_roles: ['tenant_admin', 'owner'],
  },
  {
    id: 'configure_advanced_iam',
    phase: 'role_setup',
    order: 4,
    title: 'IAM Avançado',
    description: 'Configure Identity & Access Management com grafo de acessos e políticas ABAC.',
    icon: 'KeyRound',
    is_mandatory: false,
    estimated_minutes: 20,
    route: '/settings/users',
    depends_on: ['configure_roles'],
    applies_to_tiers: ['enterprise', 'custom'],
    allowed_roles: ['tenant_admin', 'owner'],
  },

  // ═══ MODULE ACTIVATION ═══
  {
    id: 'activate_modules',
    phase: 'module_activation',
    order: 5,
    title: 'Ativar Módulos',
    description: 'Escolha quais módulos deseja ativar para sua organização.',
    icon: 'Puzzle',
    is_mandatory: false,
    estimated_minutes: 5,
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
  },
  {
    id: 'activate_analytics',
    phase: 'module_activation',
    order: 6,
    title: 'Ativar Analytics e Inteligência',
    description: 'Configure dashboards de Workforce Intelligence e indicadores estratégicos.',
    icon: 'BarChart3',
    is_mandatory: false,
    estimated_minutes: 10,
    route: '/workforce-intelligence',
    depends_on: ['activate_modules'],
    applies_to_tiers: ['enterprise', 'custom'],
    requires_modules: ['intelligence'],
    allowed_roles: ['tenant_admin', 'owner'],
  },
  {
    id: 'activate_esocial',
    phase: 'module_activation',
    order: 6,
    title: 'Configurar eSocial',
    description: 'Vincule certificado digital e configure empregador para envio de eventos.',
    icon: 'FileKey',
    is_mandatory: false,
    estimated_minutes: 15,
    route: '/esocial',
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
    requires_modules: ['esocial'],
  },

  // ═══ TEAM INVITE ═══
  {
    id: 'invite_users',
    phase: 'team_invite',
    order: 7,
    title: 'Convidar Equipe',
    description: 'Adicione outros administradores e gestores ao sistema.',
    icon: 'UserPlus',
    is_mandatory: false,
    estimated_minutes: 5,
    route: '/settings/users',
    depends_on: ['create_company'],
    applies_to_tiers: ['starter', 'professional', 'enterprise', 'custom'],
  },

  // ═══ COMPLIANCE CHECK ═══
  {
    id: 'compliance_check',
    phase: 'compliance_check',
    order: 8,
    title: 'Verificar Compliance',
    description: 'Revise as obrigações trabalhistas e de saúde ocupacional.',
    icon: 'ClipboardCheck',
    is_mandatory: true,
    estimated_minutes: 10,
    route: '/compliance',
    depends_on: ['create_company'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
    requires_modules: ['compliance'],
  },
  {
    id: 'configure_health_programs',
    phase: 'compliance_check',
    order: 9,
    title: 'Configurar Programas de Saúde',
    description: 'PCMSO, PGR e programas de saúde ocupacional.',
    icon: 'HeartPulse',
    is_mandatory: false,
    estimated_minutes: 15,
    route: '/health',
    depends_on: ['compliance_check'],
    applies_to_tiers: ['professional', 'enterprise', 'custom'],
    requires_modules: ['health'],
  },
  {
    id: 'add_employees',
    phase: 'compliance_check',
    order: 10,
    title: 'Cadastrar Colaboradores',
    description: 'Adicione os primeiros colaboradores ao sistema.',
    icon: 'Users',
    is_mandatory: true,
    estimated_minutes: 15,
    route: '/employees',
    depends_on: ['create_company'],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },

  // ═══ REVIEW ═══
  {
    id: 'review',
    phase: 'review',
    order: 99,
    title: 'Revisão Final',
    description: 'Revise as configurações e comece a usar o sistema.',
    icon: 'CheckCircle',
    is_mandatory: true,
    estimated_minutes: 2,
    depends_on: [],
    applies_to_tiers: ['free', 'starter', 'professional', 'enterprise', 'custom'],
  },
];

// ── Resolution Engine ───────────────────────────────────────────

function filterSteps(steps: StepDef[], ctx: FlowResolverContext): StepDef[] {
  return steps.filter(step => {
    // 1. Plan tier gate
    if (!step.applies_to_tiers.includes(ctx.planTier)) return false;

    // 2. Module gate
    if (step.requires_modules && step.requires_modules.length > 0) {
      if (!ctx.allowedModules) return false;
      const hasAll = step.requires_modules.every(m => ctx.allowedModules!.includes(m));
      if (!hasAll) return false;
    }

    // 3. Role gate
    if (step.allowed_roles && step.allowed_roles.length > 0) {
      if (!ctx.userRole) return true; // No role info → show by default
      if (!step.allowed_roles.includes(ctx.userRole)) return false;
    }

    return true;
  });
}

export function createOnboardingFlowResolver(): OnboardingFlowResolverAPI {
  return {
    resolveFlow(tenantId: string, ctx: FlowResolverContext): OnboardingFlow {
      const filtered = filterSteps(STEP_CATALOG, ctx);
      const sorted = [...filtered].sort((a, b) => a.order - b.order);
      const steps: OnboardingStep[] = sorted.map(s => ({ ...s, status: 'pending' as const }));

      const firstPhase = steps.length > 0 ? steps[0].phase : 'welcome';

      return {
        tenant_id: tenantId,
        plan_tier: ctx.planTier,
        steps,
        current_phase: firstPhase,
        completion_pct: 0,
        estimated_total_minutes: steps.reduce((sum, s) => sum + s.estimated_minutes, 0),
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
        s.depends_on.every(dep => {
          const depStep = flow.steps.find(d => d.id === dep);
          // If dependency doesn't exist in filtered flow, consider it satisfied
          if (!depStep) return true;
          return depStep.status === 'completed' || depStep.status === 'skipped';
        })
      );
      return ready[0] ?? null;
    },
  };
}
