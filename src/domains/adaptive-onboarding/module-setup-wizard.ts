/**
 * ModuleSetupWizard — Lists modules available for the plan
 * and recommends which to activate.
 */

import type { ModuleSetupWizardAPI, ModuleSetupOption } from './types';
import type { PlanTier } from '@/domains/platform-experience/types';

const ALL_MODULES: (ModuleSetupOption & { min_tier: PlanTier })[] = [
  { module_key: 'employees', label: 'Colaboradores', description: 'Cadastro e gestão de colaboradores.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'free' },
  { module_key: 'companies', label: 'Empresas', description: 'Gestão de empresas e CNPJs.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'free' },
  { module_key: 'departments', label: 'Departamentos', description: 'Estrutura organizacional.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'free' },
  { module_key: 'positions', label: 'Cargos', description: 'Gestão de cargos e funções.', included_in_plan: true, recommended: false, requires_setup: false, min_tier: 'free' },
  { module_key: 'groups', label: 'Grupos Empresariais', description: 'Agrupamento de empresas.', included_in_plan: true, recommended: false, requires_setup: false, min_tier: 'starter' },
  { module_key: 'compensation', label: 'Remuneração', description: 'Salários, adicionais e histórico.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'starter' },
  { module_key: 'benefits', label: 'Benefícios', description: 'Planos de benefícios e adesões.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'starter' },
  { module_key: 'payroll_simulation', label: 'Simulação de Folha', description: 'Simulação e projeção de folha de pagamento.', included_in_plan: true, recommended: false, requires_setup: false, min_tier: 'starter' },
  { module_key: 'compliance', label: 'Compliance', description: 'Compliance trabalhista e regulatório.', included_in_plan: true, recommended: true, requires_setup: true, setup_steps: ['Definir regras por CNAE', 'Configurar alertas'], min_tier: 'professional' },
  { module_key: 'health', label: 'Saúde Ocupacional', description: 'PCMSO, ASO e exames.', included_in_plan: true, recommended: true, requires_setup: true, setup_steps: ['Cadastrar programa de saúde', 'Definir periodicidade de exames'], min_tier: 'professional' },
  { module_key: 'labor_rules', label: 'Regras Trabalhistas', description: 'Motor de regras trabalhistas e CLT.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'professional' },
  { module_key: 'labor_compliance', label: 'Compliance Trabalhista', description: 'Monitoramento de conformidade trabalhista.', included_in_plan: true, recommended: false, requires_setup: false, min_tier: 'professional' },
  { module_key: 'esocial', label: 'eSocial', description: 'Geração e envio de eventos eSocial.', included_in_plan: true, recommended: false, requires_setup: true, setup_steps: ['Configurar certificado digital', 'Vincular empregador'], min_tier: 'professional' },
  { module_key: 'agreements', label: 'Acordos & Documentos', description: 'Gestão de acordos, termos e assinaturas.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'professional' },
  { module_key: 'fleet', label: 'Frota', description: 'Gestão de frota, rastreamento GPS e compliance veicular.', included_in_plan: true, recommended: false, requires_setup: true, setup_steps: ['Configurar integração Traccar', 'Cadastrar veículos'], min_tier: 'professional' },
  { module_key: 'workforce_intelligence', label: 'Inteligência', description: 'Dashboards de inteligência e analytics.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'enterprise' },
  { module_key: 'audit', label: 'Auditoria', description: 'Logs detalhados de auditoria.', included_in_plan: true, recommended: true, requires_setup: false, min_tier: 'enterprise' },
  { module_key: 'iam', label: 'IAM Avançado', description: 'Gestão avançada de identidade, acesso e federação.', included_in_plan: true, recommended: false, requires_setup: true, setup_steps: ['Configurar provedores de identidade', 'Definir políticas de acesso'], min_tier: 'enterprise' },
];

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  professional: 2,
  enterprise: 3,
  custom: 4,
};

export function createModuleSetupWizard(): ModuleSetupWizardAPI {
  return {
    getAvailableModules(planTier: PlanTier): ModuleSetupOption[] {
      const tierLevel = TIER_ORDER[planTier] ?? 0;
      return ALL_MODULES
        .filter(m => TIER_ORDER[m.min_tier] <= tierLevel)
        .map(({ min_tier, ...rest }) => ({
          ...rest,
          included_in_plan: TIER_ORDER[min_tier] <= tierLevel,
        }));
    },

    getRecommendedModules(planTier: PlanTier): ModuleSetupOption[] {
      return this.getAvailableModules(planTier).filter(m => m.recommended);
    },
  };
}
