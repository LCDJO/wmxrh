/**
 * System Atlas — Module-to-table mapping for impact analysis.
 * Maps platform modules to their database tables.
 */

export interface ModuleMapping {
  key: string;
  label: string;
  description: string;
  tables: string[];
  apis: string[];
  dependencies: string[];
}

export const MODULE_TABLE_MAP: ModuleMapping[] = [
  {
    key: 'core_hr',
    label: 'RH Core',
    description: 'Gestão de colaboradores, cargos, departamentos e organograma',
    tables: ['employees', 'departments', 'positions', 'companies', 'company_groups', 'employee_addresses', 'employee_contacts', 'employee_dependents'],
    apis: ['/employees', '/departments', '/positions', '/companies'],
    dependencies: ['iam'],
  },
  {
    key: 'compensation',
    label: 'Remuneração',
    description: 'Estrutura salarial, adicionais e histórico de remuneração',
    tables: ['employee_compensation', 'salary_history', 'compensation_simulations', 'payroll_events', 'payroll_event_items'],
    apis: ['/compensation', '/salary-history', '/payroll-simulation'],
    dependencies: ['core_hr'],
  },
  {
    key: 'benefits',
    label: 'Benefícios',
    description: 'Planos de benefícios e gestão de elegibilidade',
    tables: ['benefit_plans', 'employee_benefits'],
    apis: ['/benefits', '/benefit-plans'],
    dependencies: ['core_hr'],
  },
  {
    key: 'agreements',
    label: 'Termos & Documentos',
    description: 'Gestão de termos, assinatura digital e vault de documentos',
    tables: ['agreement_templates', 'agreement_template_versions', 'employee_agreements', 'agreement_assignment_rules'],
    apis: ['/agreements', '/agreement-templates'],
    dependencies: ['core_hr'],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    description: 'Conformidade trabalhista e regulatória',
    tables: ['compliance_checks', 'regulatory_updates', 'compliance_audit_reports'],
    apis: ['/compliance'],
    dependencies: ['core_hr'],
  },
  {
    key: 'recruitment',
    label: 'Recrutamento',
    description: 'ATS, vagas e pipeline de candidatos',
    tables: ['ats_requisitions', 'ats_candidates', 'ats_pipeline_stages'],
    apis: ['/requisitions', '/candidates'],
    dependencies: ['core_hr'],
  },
  {
    key: 'fleet',
    label: 'Frota',
    description: 'Gestão de veículos e rastreamento',
    tables: ['vehicles', 'vehicle_documents', 'vehicle_inspections', 'traccar_devices', 'traccar_geofences'],
    apis: ['/vehicles', '/traccar'],
    dependencies: [],
  },
  {
    key: 'billing',
    label: 'Financeiro / Fiscal',
    description: 'Planos SaaS, faturas e cobrança',
    tables: ['tenant_plans', 'invoices', 'billing_adjustments', 'coupon_codes', 'coupon_redemptions'],
    apis: ['/billing', '/invoices', '/plans'],
    dependencies: ['iam'],
  },
  {
    key: 'iam',
    label: 'IAM',
    description: 'Gestão de usuários, roles, permissões e políticas de acesso',
    tables: ['platform_users', 'profiles', 'user_sessions', 'session_history', 'tenant_user_roles', 'platform_roles', 'platform_role_permissions'],
    apis: ['/auth', '/users', '/roles'],
    dependencies: [],
  },
  {
    key: 'automation',
    label: 'Automação',
    description: 'Regras de automação baseadas em eventos',
    tables: ['automation_rules', 'automation_rule_executions'],
    apis: ['/automation-rules'],
    dependencies: ['iam'],
  },
  {
    key: 'audit',
    label: 'Auditoria',
    description: 'Logs de auditoria e rastreabilidade',
    tables: ['audit_logs', 'biometric_audit_trail'],
    apis: ['/audit-logs'],
    dependencies: ['iam'],
  },
  {
    key: 'observability',
    label: 'Observabilidade',
    description: 'Monitoramento, status e saúde',
    tables: ['status_page_components', 'status_page_incidents', 'availability_records', 'bcdr_region_health'],
    apis: ['/status', '/health'],
    dependencies: [],
  },
  {
    key: 'growth',
    label: 'Growth Engine',
    description: 'Landing pages, conversões e referrals',
    tables: ['landing_pages', 'landing_page_versions', 'landing_submissions', 'referral_codes', 'referral_conversions'],
    apis: ['/landing-pages', '/referrals'],
    dependencies: ['billing'],
  },
  {
    key: 'governance',
    label: 'Governança',
    description: 'Políticas, enforcement e appeals',
    tables: ['account_enforcements', 'ban_registry', 'tenant_announcements'],
    apis: ['/governance', '/enforcement'],
    dependencies: ['iam'],
  },
  {
    key: 'api_management',
    label: 'APIs & Integrações',
    description: 'Gestão de clientes API, chaves e rate limits',
    tables: ['api_clients', 'api_keys', 'api_scopes', 'api_usage_logs', 'api_rate_limit_configs', 'api_versions', 'api_analytics_aggregates'],
    apis: ['/api-clients', '/api-keys'],
    dependencies: ['iam'],
  },
];

/** Get module that owns a given table */
export function getModuleForTable(tableName: string): ModuleMapping | undefined {
  return MODULE_TABLE_MAP.find(m => m.tables.includes(tableName));
}

/** Get all modules that reference a given table (via foreign keys) */
export function getRelatedModules(tableName: string): ModuleMapping[] {
  return MODULE_TABLE_MAP.filter(m => m.tables.includes(tableName));
}
