/**
 * Available SaaS modules for tenant activation.
 */
export const PLATFORM_MODULES = [
  { key: 'core_hr', label: 'RH Core', description: 'Gestão de colaboradores, cargos e departamentos', icon: 'Users' },
  { key: 'compensation', label: 'Remuneração', description: 'Estrutura salarial, adicionais e histórico', icon: 'DollarSign' },
  { key: 'benefits', label: 'Benefícios', description: 'Planos de benefícios e gestão de elegibilidade', icon: 'Heart' },
  { key: 'compliance', label: 'Compliance', description: 'Conformidade trabalhista e regulatória', icon: 'Shield' },
  { key: 'health', label: 'Saúde Ocupacional', description: 'PCMSO, ASO, exames e programas de saúde', icon: 'Activity' },
  { key: 'esocial', label: 'eSocial', description: 'Geração e transmissão de eventos eSocial', icon: 'FileText' },
  { key: 'payroll_sim', label: 'Simulação Folha', description: 'Simulação de folha de pagamento completa', icon: 'Calculator' },
  { key: 'agreements', label: 'Termos & Documentos', description: 'Gestão de termos, assinatura digital', icon: 'FileSignature' },
  { key: 'workforce_intel', label: 'Inteligência', description: 'Analytics, projeções e insights de workforce', icon: 'Brain' },
  { key: 'labor_rules', label: 'Regras Trabalhistas', description: 'CCT, pisos, jornadas e regras sindicais', icon: 'Scale' },
  { key: 'nr_training', label: 'Treinamentos NR', description: 'Gestão de treinamentos normativos', icon: 'GraduationCap' },
  { key: 'iam', label: 'IAM', description: 'Gestão de usuários, roles e permissões', icon: 'Key' },
] as const;

export type ModuleKey = typeof PLATFORM_MODULES[number]['key'];
