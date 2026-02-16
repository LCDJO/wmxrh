/**
 * WorkspaceOnboardingIntelligence — Future: AI-driven smart onboarding.
 *
 * Planned capabilities:
 *   - Detect tenant industry from CNAE and recommend initial module set
 *   - Auto-create starter roles with sensible permissions
 *   - Guide user through mandatory compliance setup (eSocial, NRs, PCMSO)
 *   - Generate onboarding checklist dynamically based on company profile
 *   - Track onboarding completion and nudge incomplete steps
 *   - Learn from successful onboardings to improve recommendations
 *
 * SECURITY CONTRACT:
 *   Onboarding actions are SUGGESTIVE. The system proposes steps and
 *   configurations, but the user MUST confirm each action. No data is
 *   written without explicit user approval.
 */

// ── Types ────────────────────────────────────────────────────────

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface OnboardingStep {
  id: string;
  order: number;
  title: string;
  description: string;
  category: 'company' | 'compliance' | 'roles' | 'employees' | 'modules' | 'integrations';
  status: OnboardingStepStatus;
  /** Route to navigate to for this step */
  route?: string;
  /** Whether the step is mandatory for the tenant's industry */
  is_mandatory: boolean;
  /** Estimated time in minutes */
  estimated_minutes: number;
  /** Dependencies — IDs of steps that must be completed first */
  depends_on: string[];
}

export interface OnboardingPlan {
  tenant_id: string;
  steps: OnboardingStep[];
  estimated_total_minutes: number;
  completion_pct: number;
  generated_at: number;
  source: 'ai' | 'rule-based' | 'default';
}

export interface OnboardingRecommendation {
  plan: OnboardingPlan;
  /** Why this plan was recommended */
  reason: string;
  /** Suggested modules to activate */
  recommended_modules: string[];
  /** Suggested starter roles */
  recommended_roles: { name: string; permissions: string[] }[];
}

// ── Default Steps ────────────────────────────────────────────────

const DEFAULT_STEPS: Omit<OnboardingStep, 'status'>[] = [
  { id: 'create_company', order: 1, title: 'Cadastrar Empresa', description: 'Adicione os dados da empresa principal (CNPJ, razão social, endereço).', category: 'company', route: '/companies', is_mandatory: true, estimated_minutes: 5, depends_on: [] },
  { id: 'setup_departments', order: 2, title: 'Criar Departamentos', description: 'Organize a estrutura departamental da empresa.', category: 'company', route: '/departments', is_mandatory: false, estimated_minutes: 5, depends_on: ['create_company'] },
  { id: 'configure_roles', order: 3, title: 'Configurar Cargos', description: 'Defina os cargos e permissões do sistema.', category: 'roles', route: '/settings/roles', is_mandatory: true, estimated_minutes: 10, depends_on: ['create_company'] },
  { id: 'invite_users', order: 4, title: 'Convidar Usuários', description: 'Adicione outros administradores e gestores.', category: 'roles', route: '/settings/users', is_mandatory: false, estimated_minutes: 5, depends_on: ['configure_roles'] },
  { id: 'add_employees', order: 5, title: 'Cadastrar Colaboradores', description: 'Adicione os primeiros colaboradores ao sistema.', category: 'employees', route: '/employees', is_mandatory: true, estimated_minutes: 15, depends_on: ['create_company', 'setup_departments'] },
  { id: 'compliance_check', order: 6, title: 'Verificar Compliance', description: 'Revise as obrigações trabalhistas e de saúde ocupacional.', category: 'compliance', route: '/compliance', is_mandatory: true, estimated_minutes: 10, depends_on: ['create_company'] },
];

// ── Stub Service ─────────────────────────────────────────────────

export class WorkspaceOnboardingIntelligence {
  /**
   * Generate an onboarding plan for a new tenant.
   *
   * Future: uses CNAE data + AI to create a personalised plan.
   * Current: returns the default checklist.
   */
  async generatePlan(
    tenantId: string,
    _cnae?: string,
    _industry?: string,
  ): Promise<OnboardingRecommendation> {
    const steps: OnboardingStep[] = DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' as const }));

    return {
      plan: {
        tenant_id: tenantId,
        steps,
        estimated_total_minutes: steps.reduce((sum, s) => sum + s.estimated_minutes, 0),
        completion_pct: 0,
        generated_at: Date.now(),
        source: 'default',
      },
      reason: 'Plano de onboarding padrão. Personalização por IA será ativada quando o CNAE da empresa for identificado.',
      recommended_modules: ['employees', 'compliance', 'payroll'],
      recommended_roles: [
        { name: 'Administrador RH', permissions: ['employees.read', 'employees.write', 'salary.read', 'benefits.read', 'benefits.write'] },
        { name: 'Gestor Departamental', permissions: ['employees.read', 'departments.read', 'departments.write'] },
      ],
    };
  }

  /**
   * Update step status (stub).
   * Future: persists to tenant_onboarding_progress table.
   */
  async updateStep(_tenantId: string, stepId: string, status: OnboardingStepStatus): Promise<void> {
    console.info(`[WorkspaceOnboarding] stub: step "${stepId}" → ${status}`);
  }

  /**
   * Get next recommended action based on current progress (stub).
   */
  getNextAction(plan: OnboardingPlan): OnboardingStep | null {
    const pending = plan.steps
      .filter(s => s.status === 'pending')
      .filter(s => s.depends_on.every(dep => plan.steps.find(d => d.id === dep)?.status === 'completed'));

    return pending[0] ?? null;
  }
}

/** Singleton */
export const workspaceOnboarding = new WorkspaceOnboardingIntelligence();
