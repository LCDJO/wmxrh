/**
 * Unified Module Registry — Single source of truth for all platform modules.
 *
 * Categories:
 *  - 'platform': SaaS infrastructure modules (billing, IAM, observability, etc.)
 *  - 'domain':   HR business modules (core_hr, benefits, compliance, etc.)
 */

export type ModuleCategory = 'platform' | 'domain';

export interface PlatformModule {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: ModuleCategory;
}

export const PLATFORM_MODULES: readonly PlatformModule[] = [
  // ── Domain: RH / Gestão de Pessoas ──────────────────────────
  { key: 'core_hr',         label: 'RH Core',              description: 'Gestão de colaboradores, cargos, departamentos e organograma',           icon: 'Users',          category: 'domain' },
  { key: 'employees',       label: 'Colaboradores',         description: 'Cadastro, admissão, desligamento e gestão do ciclo de vida do colaborador', icon: 'Users',       category: 'domain' },
  { key: 'departments',     label: 'Departamentos',         description: 'Estrutura departamental e hierarquia organizacional',                    icon: 'Briefcase',      category: 'domain' },
  { key: 'positions',       label: 'Cargos',                description: 'Definição de cargos, CBO, níveis e plano de carreira',                  icon: 'UserCog',        category: 'domain' },
  { key: 'companies',       label: 'Empresas',              description: 'Gestão multi-empresa com CNPJ, filiais e dados fiscais',                 icon: 'Building2',      category: 'domain' },
  { key: 'groups',          label: 'Grupos Econômicos',     description: 'Agrupamento de empresas em grupos econômicos com visão consolidada',     icon: 'Layers',         category: 'domain' },
  { key: 'compensation',    label: 'Remuneração',           description: 'Estrutura salarial, adicionais e histórico de remuneração',              icon: 'DollarSign',     category: 'domain' },
  { key: 'payroll_simulation', label: 'Simulação de Folha', description: 'Simulação completa de folha de pagamento com encargos',                  icon: 'Calculator',     category: 'domain' },
  { key: 'benefits',        label: 'Benefícios',            description: 'Planos de benefícios e gestão de elegibilidade',                         icon: 'Heart',          category: 'domain' },
  { key: 'compliance',      label: 'Compliance',            description: 'Conformidade trabalhista e regulatória',                                 icon: 'Shield',         category: 'domain' },
  { key: 'health',          label: 'Saúde Ocupacional',     description: 'PCMSO, ASO, exames e programas de saúde',                                icon: 'Activity',       category: 'domain' },
  { key: 'esocial',         label: 'eSocial',               description: 'Geração e transmissão de eventos eSocial',                               icon: 'FileText',       category: 'domain' },
  { key: 'payroll_sim',     label: 'Simulação Folha (Legacy)', description: 'Simulação de folha de pagamento completa (legacy key)',               icon: 'Calculator',     category: 'domain' },
  { key: 'agreements',      label: 'Termos & Documentos',   description: 'Gestão de termos, assinatura digital e vault de documentos',             icon: 'FileSignature',  category: 'domain' },
  { key: 'workforce_intelligence', label: 'Inteligência RH', description: 'Analytics avançado, projeções e insights estratégicos de workforce',   icon: 'Brain',          category: 'domain' },
  { key: 'workforce_intel', label: 'Inteligência RH (Legacy)', description: 'Analytics, projeções e insights de workforce (legacy key)',           icon: 'Brain',          category: 'domain' },
  { key: 'labor_rules',     label: 'Regras Trabalhistas',   description: 'CCT, pisos, jornadas e regras sindicais',                                icon: 'Scale',          category: 'domain' },
  { key: 'labor_compliance', label: 'Compliance Trabalhista', description: 'Conformidade legal, auditoria trabalhista e gestão de riscos',         icon: 'Scale',          category: 'domain' },
  { key: 'fleet',           label: 'Frota',                 description: 'Gestão de frota, compliance veicular e rastreamento',                    icon: 'Car',            category: 'domain' },
  { key: 'audit',           label: 'Auditoria',             description: 'Logs de auditoria, rastreabilidade e compliance de acessos',             icon: 'ScrollText',     category: 'domain' },
  { key: 'nr_training',     label: 'Treinamentos NR',       description: 'Gestão de treinamentos normativos',                                     icon: 'GraduationCap',  category: 'domain' },
  { key: 'compensation_engine', label: 'Motor de Compensação', description: 'Simulações salariais, reajustes em massa e tabelas de compensação', icon: 'TrendingUp',     category: 'domain' },
  { key: 'support_module', label: 'Suporte',               description: 'Módulo versionado de atendimento — Tenant Experience + Platform Console + Chat ao Vivo + Wiki + Analytics', icon: 'Headphones', category: 'domain' },
  { key: 'fleet_traccar',  label: 'Traccar (GPS/Frota)',   description: 'Rastreamento GPS, compliance de frota, geofencing e políticas disciplinares via Traccar', icon: 'Car', category: 'domain' },

  // ── Platform: Infraestrutura SaaS ───────────────────────────
  { key: 'iam',              label: 'IAM',                  description: 'Gestão de usuários, roles, permissões e políticas de acesso',            icon: 'Key',            category: 'platform' },
  { key: 'tenant_admin',     label: 'Admin Tenant',         description: 'Convites, papéis, configurações e toggles de módulos por tenant',        icon: 'Settings',       category: 'platform' },
  { key: 'billing',          label: 'Financeiro / Fiscal',  description: 'Planos SaaS, faturas, cupons, ajustes, cobrança baseada em uso e gestão fiscal', icon: 'CreditCard', category: 'platform' },
  { key: 'automation',       label: 'Automação',            description: 'Regras de automação baseadas em eventos com condições e ações',          icon: 'Zap',            category: 'platform' },
  { key: 'observability',    label: 'Observabilidade',      description: 'Monitoramento de saúde, rastreamento de erros e métricas',               icon: 'Monitor',        category: 'platform' },
  { key: 'analytics',        label: 'Analytics',            description: 'Dashboards, relatórios e detecção de anomalias',                        icon: 'BarChart3',      category: 'platform' },
  { key: 'ads',              label: 'Ads & Campanhas',      description: 'Gestão de campanhas publicitárias e relatórios de performance',          icon: 'Megaphone',      category: 'platform' },
  { key: 'growth',           label: 'Growth Engine',        description: 'Experimentos de crescimento, A/B testing e métricas de conversão',      icon: 'Rocket',         category: 'platform' },
  { key: 'landing_engine',   label: 'Landing Engine',       description: 'Construtor de landing pages com versionamento e A/B testing',            icon: 'Layout',         category: 'platform' },
  { key: 'website_engine',   label: 'Website Engine',       description: 'Páginas institucionais, blog e gestão de conteúdo',                     icon: 'Globe',          category: 'platform' },
  { key: 'autonomous_ops',  label: 'Autonomous Ops AI',    description: 'Inteligência operacional: análise de sinais, predição de riscos, sugestões de automação e otimização de receita', icon: 'Brain', category: 'platform' },
  { key: 'esocial_governance', label: 'Governança eSocial', description: 'Monitoramento central de layout, certificados, alertas e conformidade eSocial por tenant', icon: 'ShieldCheck', category: 'platform' },
  { key: 'user_presence',     label: 'User Presence',        description: 'Monitoramento de sessões ativas, localização, dispositivos e login intelligence em tempo real', icon: 'Eye', category: 'platform' },
] as const;

export type ModuleKey = typeof PLATFORM_MODULES[number]['key'];

/** Helper: get only domain (HR) modules */
export const getDomainModules = () => PLATFORM_MODULES.filter(m => m.category === 'domain');

/** Helper: get only platform (SaaS) modules */
export const getPlatformModules = () => PLATFORM_MODULES.filter(m => m.category === 'platform');
