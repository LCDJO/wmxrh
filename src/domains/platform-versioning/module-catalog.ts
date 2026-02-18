/**
 * ModuleCatalog — Central registry of all platform modules.
 * Used by the versioning engine to seed and track module versions.
 */

export interface ModuleCatalogEntry {
  module_id: string;
  name: string;
  description: string;
  initial_version: { major: number; minor: number; patch: number };
  changelog_summary: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    module_id: 'core_hr',
    name: 'Core HR',
    description: 'Gestão de colaboradores, departamentos, cargos e organograma.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — CRUD de colaboradores, eventos, departamentos e cargos.',
  },
  {
    module_id: 'customer_support',
    name: 'Suporte ao Cliente',
    description: 'Tickets, chat ao vivo, base de conhecimento e avaliações.',
    initial_version: { major: 1, minor: 1, patch: 0 },
    changelog_summary: 'v1.1.0 — Chat ao vivo estilo WhatsApp, página dedicada /support/chat, painel de detalhes com protocolo e atendente.',
  },
  {
    module_id: 'ads',
    name: 'Ads & Campanhas',
    description: 'Gestão de campanhas publicitárias e relatórios de performance.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Criação, pausa e relatórios de campanhas.',
  },
  {
    module_id: 'analytics',
    name: 'Analytics',
    description: 'Dashboards, relatórios e detecção de anomalias.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Dashboards, refresh automático e detecção de anomalias.',
  },
  {
    module_id: 'compensation_engine',
    name: 'Compensation Engine',
    description: 'Simulações salariais, reajustes em massa e tabelas de compensação.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Simulações, ajustes salariais e reajustes em massa.',
  },
  {
    module_id: 'observability',
    name: 'Observabilidade',
    description: 'Monitoramento de saúde, rastreamento de erros e métricas de performance.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Health checks, captura de erros, profiling e exportação de métricas.',
  },
  {
    module_id: 'tenant_admin',
    name: 'Administração do Tenant',
    description: 'Convites, papéis, configurações e toggles de módulos por tenant.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Convites, atribuição de roles, toggle de módulos e configurações.',
  },
  {
    module_id: 'billing',
    name: 'Billing & Faturamento',
    description: 'Planos, faturas, cupons, ajustes e cobrança baseada em uso.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Planos SaaS, invoices, cupons e ajustes de cobrança.',
  },
  {
    module_id: 'landing_engine',
    name: 'Landing Engine',
    description: 'Construtor de landing pages com versionamento e A/B testing.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Builder de landing pages com snapshots e rollback.',
  },
  {
    module_id: 'website_engine',
    name: 'Website Engine',
    description: 'Páginas institucionais, blog e gestão de conteúdo.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Gestão de páginas e conteúdo institucional.',
  },
  {
    module_id: 'iam',
    name: 'IAM (Identity & Access)',
    description: 'Roles customizados, permissões granulares e políticas de acesso.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Roles, permissões, scopes e políticas de acesso.',
  },
  {
    module_id: 'automation',
    name: 'Automação',
    description: 'Regras de automação baseadas em eventos com condições e ações.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Regras de trigger, condições e ações automatizadas.',
  },
  {
    module_id: 'growth',
    name: 'Growth Engine',
    description: 'Experimentos de crescimento, A/B testing e métricas de conversão.',
    initial_version: { major: 1, minor: 0, patch: 0 },
    changelog_summary: 'Versão inicial — Experimentos, variantes e tracking de conversão.',
  },
];
