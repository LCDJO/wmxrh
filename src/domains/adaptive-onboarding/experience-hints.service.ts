/**
 * ExperienceHintsService — Contextual hints and tips for each onboarding step.
 */

import type { ExperienceHintsServiceAPI, OnboardingHint } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

const HINT_CATALOG: Record<string, (tier: PlanTier) => OnboardingHint[]> = {
  welcome: (tier) => [
    {
      id: 'welcome_tip',
      step_id: 'welcome',
      title: 'Dica rápida',
      description: tier === 'free'
        ? 'No plano Free, você pode gerenciar até 10 colaboradores. Faça upgrade para desbloquear mais recursos.'
        : `Seu plano ${tier} inclui recursos avançados. Vamos configurar tudo!`,
      type: 'tip',
      priority: 1,
      dismissed: false,
    },
  ],
  create_company: () => [
    {
      id: 'cnpj_tip',
      step_id: 'create_company',
      title: 'CNPJ automático',
      description: 'Ao informar o CNPJ, buscaremos automaticamente os dados da empresa na Receita Federal.',
      type: 'tip',
      priority: 1,
      dismissed: false,
    },
  ],
  configure_roles: () => [
    {
      id: 'roles_recommendation',
      step_id: 'configure_roles',
      title: 'Papéis recomendados',
      description: 'Sugerimos começar com os papéis padrão. Você pode customizá-los depois.',
      type: 'recommendation',
      priority: 1,
      dismissed: false,
    },
  ],
  compliance_check: (tier) => tier === 'professional' || tier === 'enterprise' ? [
    {
      id: 'compliance_warning',
      step_id: 'compliance_check',
      title: 'Compliance obrigatório',
      description: 'Com base no CNAE da empresa, identificamos NRs aplicáveis. Revise com atenção.',
      type: 'compliance',
      priority: 0,
      dismissed: false,
    },
  ] : [],
  add_employees: () => [
    {
      id: 'employees_tip',
      step_id: 'add_employees',
      title: 'Importação em lote',
      description: 'Você pode importar colaboradores via planilha Excel ou CSV. Disponível no módulo de Colaboradores.',
      type: 'tip',
      priority: 2,
      dismissed: false,
    },
  ],
};

const dismissedHints = new Set<string>();

export function createExperienceHintsService(): ExperienceHintsServiceAPI {
  return {
    getHintsForStep(stepId: string, planTier: PlanTier): OnboardingHint[] {
      const factory = HINT_CATALOG[stepId];
      if (!factory) return [];
      return factory(planTier).filter(h => !dismissedHints.has(h.id));
    },

    dismissHint(hintId: string): void {
      dismissedHints.add(hintId);
    },
  };
}
