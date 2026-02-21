/**
 * ══════════════════════════════════════════════════════════
 * TENANT LAYER (Client) — Registry & Manifest
 * ══════════════════════════════════════════════════════════
 *
 * The Tenant Layer contains ALL operational, client-scoped
 * domains. Every piece of data is isolated by tenant_id
 * and protected by RLS policies.
 *
 *  ✅ Stores operational client data
 *  ✅ Runs business logic scoped to tenant
 *  ✅ Consumes normalized events from Platform Layer
 *  ✅ Never accesses other tenants' data
 *
 * Subdomains:
 *  · Funcionários          · Veículos
 *  · Dispositivos GPS      · Regras de comportamento
 *  · Infrações             · Advertências
 *  · Termos assinados      · Plano de cargos
 *  · SST                   · EPI
 *  · PCMSO                 · Payroll Simulation
 */

// ══════════════════════════════════════════════════════════
// DOMAIN REGISTRY
// ══════════════════════════════════════════════════════════

export const TENANT_DOMAINS = {
  // ─────────────────────────────────────
  // 1. CORE HR
  // ─────────────────────────────────────
  EMPLOYEE:                 'employee',
  COMPANY:                  'company',
  COMPANY_GROUP:            'company-group',
  DEPARTMENT:               'department',
  POSITION:                 'position',
  COMPENSATION:             'compensation',

  // ─────────────────────────────────────
  // 2. PLANO DE CARGOS & CARREIRA
  // ─────────────────────────────────────
  CAREER_INTELLIGENCE:      'career-intelligence',

  // ─────────────────────────────────────
  // 3. FROTA — Veículos, GPS, Comportamento
  // ─────────────────────────────────────
  FLEET_VEHICLES:           'fleet-vehicles',
  FLEET_GPS_DEVICES:        'fleet-gps-devices',
  FLEET_BEHAVIOR_RULES:     'fleet-behavior-rules',
  FLEET_INFRACTIONS:        'fleet-infractions',
  FLEET_WARNINGS:           'fleet-warnings',
  FLEET_OPERATIONS:         'fleet-compliance',

  // ─────────────────────────────────────
  // 4. COMPLIANCE & LABOR
  // ─────────────────────────────────────
  LABOR_COMPLIANCE:         'labor-compliance',
  LABOR_RULES:              'labor-rules',
  COMPLIANCE:               'compliance',
  ESOCIAL:                  'esocial',
  ESOCIAL_GOVERNANCE:       'esocial-governance',

  // ─────────────────────────────────────
  // 5. SST — Saúde e Segurança do Trabalho
  // ─────────────────────────────────────
  SST:                      'sst',
  PCMSO:                    'pcmso',
  EPI_INVENTORY:            'epi-inventory',
  EPI_LIFECYCLE:            'epi-lifecycle',
  NR_TRAINING_LIFECYCLE:    'nr-training-lifecycle',
  SAFETY_AUTOMATION:        'safety-automation',
  OCCUPATIONAL_INTEL:       'occupational-intelligence',

  // ─────────────────────────────────────
  // 6. DOCUMENTOS & TERMOS ASSINADOS
  // ─────────────────────────────────────
  EMPLOYEE_AGREEMENT:       'employee-agreement',
  ANNOUNCEMENTS:            'announcements',

  // ─────────────────────────────────────
  // 7. INTELLIGENCE & ANALYTICS
  // ─────────────────────────────────────
  WORKFORCE_INTELLIGENCE:   'workforce-intelligence',
  PAYROLL_SIMULATION:       'payroll-simulation',
  GOVERNANCE_AI:            'governance-ai',

  // ─────────────────────────────────────
  // 8. TENANT OPERATIONS
  // ─────────────────────────────────────
  NOTIFICATIONS:            'notifications',
  ADAPTIVE_ONBOARDING:      'adaptive-onboarding',
  AUTOMATION:               'automation',
  SUPPORT:                  'support',
  GOVERNANCE:               'governance',
  INTEGRATION_AUTOMATION:   'integration-automation',
  MENU_STRUCTURE:           'menu-structure',
} as const;

export type TenantDomainKey = keyof typeof TENANT_DOMAINS;

// ══════════════════════════════════════════════════════════
// CAPABILITY DEFINITIONS
// ══════════════════════════════════════════════════════════

export interface TenantCapability {
  key: TenantDomainKey;
  domain: string;
  category: TenantCapabilityCategory;
  description: string;
  storesClientData: true;
  scope: 'tenant';
  requiresRLS: true;
  /** Database tables owned by this capability */
  tables?: string[];
}

export type TenantCapabilityCategory =
  | 'core_hr'
  | 'career'
  | 'fleet'
  | 'compliance'
  | 'sst'
  | 'documents'
  | 'intelligence'
  | 'operations';

const BASE: Pick<TenantCapability, 'storesClientData' | 'scope' | 'requiresRLS'> = {
  storesClientData: true,
  scope: 'tenant',
  requiresRLS: true,
};

export const TENANT_CAPABILITIES: TenantCapability[] = [
  // ── 1. Core HR ──
  {
    ...BASE,
    key: 'EMPLOYEE',
    domain: TENANT_DOMAINS.EMPLOYEE,
    category: 'core_hr',
    description: 'Cadastro de funcionários, perfis, documentos e onboarding — isolado por tenant_id',
    tables: ['employees', 'employee_documents', 'employee_dependents'],
  },
  {
    ...BASE,
    key: 'COMPANY',
    domain: TENANT_DOMAINS.COMPANY,
    category: 'core_hr',
    description: 'Gestão de empresas e filiais dentro do tenant',
    tables: ['companies', 'company_cnae_profiles'],
  },
  {
    ...BASE,
    key: 'COMPANY_GROUP',
    domain: TENANT_DOMAINS.COMPANY_GROUP,
    category: 'core_hr',
    description: 'Grupos econômicos — consolidação multi-empresa',
    tables: ['company_groups'],
  },
  {
    ...BASE,
    key: 'DEPARTMENT',
    domain: TENANT_DOMAINS.DEPARTMENT,
    category: 'core_hr',
    description: 'Departamentos e centros de custo por empresa',
    tables: ['departments'],
  },
  {
    ...BASE,
    key: 'POSITION',
    domain: TENANT_DOMAINS.POSITION,
    category: 'core_hr',
    description: 'Cargos, CBO, faixas salariais',
    tables: ['positions', 'career_positions'],
  },
  {
    ...BASE,
    key: 'COMPENSATION',
    domain: TENANT_DOMAINS.COMPENSATION,
    category: 'core_hr',
    description: 'Histórico salarial, benefícios e remuneração variável',
    tables: ['benefit_plans'],
  },

  // ── 2. Plano de Cargos & Carreira ──
  {
    ...BASE,
    key: 'CAREER_INTELLIGENCE',
    domain: TENANT_DOMAINS.CAREER_INTELLIGENCE,
    category: 'career',
    description: 'Trilhas de carreira, requisitos de transição, benchmarks salariais e alertas de risco',
    tables: ['career_paths', 'career_path_steps', 'career_tracks', 'career_salary_benchmarks', 'career_risk_alerts', 'career_legal_mappings', 'career_legal_requirements'],
  },

  // ── 3. Frota — Veículos, GPS, Comportamento ──
  {
    ...BASE,
    key: 'FLEET_VEHICLES',
    domain: TENANT_DOMAINS.FLEET_VEHICLES,
    category: 'fleet',
    description: 'Cadastro de veículos da frota — placa, modelo, vinculação com colaborador',
    tables: ['fleet_vehicles'],
  },
  {
    ...BASE,
    key: 'FLEET_GPS_DEVICES',
    domain: TENANT_DOMAINS.FLEET_GPS_DEVICES,
    category: 'fleet',
    description: 'Dispositivos GPS/Traccar vinculados a veículos — config de provedor, device ID',
    tables: ['fleet_provider_configs'],
  },
  {
    ...BASE,
    key: 'FLEET_BEHAVIOR_RULES',
    domain: TENANT_DOMAINS.FLEET_BEHAVIOR_RULES,
    category: 'fleet',
    description: 'Regras de comportamento de condução — limites de velocidade, harsh braking, geofences',
    tables: ['fleet_behavior_rules'],
  },
  {
    ...BASE,
    key: 'FLEET_INFRACTIONS',
    domain: TENANT_DOMAINS.FLEET_INFRACTIONS,
    category: 'fleet',
    description: 'Infrações detectadas automaticamente e multas reais atribuídas a motoristas',
    tables: ['fleet_behavior_events', 'raw_tracking_events'],
  },
  {
    ...BASE,
    key: 'FLEET_WARNINGS',
    domain: TENANT_DOMAINS.FLEET_WARNINGS,
    category: 'fleet',
    description: 'Advertências formais geradas automaticamente por acúmulo de infrações',
    tables: ['fleet_warnings', 'fleet_audit_log'],
  },
  {
    ...BASE,
    key: 'FLEET_OPERATIONS',
    domain: TENANT_DOMAINS.FLEET_OPERATIONS,
    category: 'fleet',
    description: 'Orquestração geral da frota — score comportamental, predição de acidentes, dashboard',
  },

  // ── 4. Compliance & Labor ──
  {
    ...BASE,
    key: 'LABOR_COMPLIANCE',
    domain: TENANT_DOMAINS.LABOR_COMPLIANCE,
    category: 'compliance',
    description: 'Verificações de conformidade trabalhista e rastreamento de violações por tenant',
    tables: ['compliance_violations', 'compliance_evaluations'],
  },
  {
    ...BASE,
    key: 'LABOR_RULES',
    domain: TENANT_DOMAINS.LABOR_RULES,
    category: 'compliance',
    description: 'Regras trabalhistas aplicáveis ao tenant — CCT, CLT, acordos coletivos',
    tables: ['collective_agreements', 'collective_agreement_clauses'],
  },
  {
    ...BASE,
    key: 'ESOCIAL',
    domain: TENANT_DOMAINS.ESOCIAL,
    category: 'compliance',
    description: 'Eventos eSocial do tenant — S-2200, S-2206, S-2299, etc.',
  },
  {
    ...BASE,
    key: 'ESOCIAL_GOVERNANCE',
    domain: TENANT_DOMAINS.ESOCIAL_GOVERNANCE,
    category: 'compliance',
    description: 'Governança e auditoria de envios eSocial',
  },

  // ── 5. SST — Saúde e Segurança do Trabalho ──
  {
    ...BASE,
    key: 'SST',
    domain: TENANT_DOMAINS.SST,
    category: 'sst',
    description: 'Gestão centralizada de SST — PGR, LTCAT, laudos e programas obrigatórios',
  },
  {
    ...BASE,
    key: 'PCMSO',
    domain: TENANT_DOMAINS.PCMSO,
    category: 'sst',
    description: 'Programa de Controle Médico de Saúde Ocupacional — ASOs, exames periódicos, cronogramas',
  },
  {
    ...BASE,
    key: 'EPI_INVENTORY',
    domain: TENANT_DOMAINS.EPI_INVENTORY,
    category: 'sst',
    description: 'Inventário de EPIs — CAs, estoque, fornecedores e rastreabilidade',
  },
  {
    ...BASE,
    key: 'EPI_LIFECYCLE',
    domain: TENANT_DOMAINS.EPI_LIFECYCLE,
    category: 'sst',
    description: 'Ciclo de vida de EPIs — entrega, devolução, troca e termos de responsabilidade',
  },
  {
    ...BASE,
    key: 'NR_TRAINING_LIFECYCLE',
    domain: TENANT_DOMAINS.NR_TRAINING_LIFECYCLE,
    category: 'sst',
    description: 'Treinamentos obrigatórios por NR — controle de validade, reciclagem e certificados',
  },
  {
    ...BASE,
    key: 'SAFETY_AUTOMATION',
    domain: TENANT_DOMAINS.SAFETY_AUTOMATION,
    category: 'sst',
    description: 'Automação de workflows de segurança — alertas, checklists e ações corretivas',
  },
  {
    ...BASE,
    key: 'OCCUPATIONAL_INTEL',
    domain: TENANT_DOMAINS.OCCUPATIONAL_INTEL,
    category: 'sst',
    description: 'Inteligência ocupacional — análise de riscos por CBO/CNAE, mapa de calor de exposição',
  },

  // ── 6. Documentos & Termos Assinados ──
  {
    ...BASE,
    key: 'EMPLOYEE_AGREEMENT',
    domain: TENANT_DOMAINS.EMPLOYEE_AGREEMENT,
    category: 'documents',
    description: 'Templates de termos, fluxo de assinatura digital e versionamento',
    tables: ['agreement_templates', 'agreement_template_versions'],
  },
  {
    ...BASE,
    key: 'ANNOUNCEMENTS',
    domain: TENANT_DOMAINS.ANNOUNCEMENTS,
    category: 'documents',
    description: 'Comunicados internos com controle de leitura/dispensa',
    tables: ['tenant_announcements', 'announcement_dismissals'],
  },

  // ── 7. Intelligence & Analytics ──
  {
    ...BASE,
    key: 'WORKFORCE_INTELLIGENCE',
    domain: TENANT_DOMAINS.WORKFORCE_INTELLIGENCE,
    category: 'intelligence',
    description: 'Analytics de workforce — headcount, turnover, risco operacional',
  },
  {
    ...BASE,
    key: 'PAYROLL_SIMULATION',
    domain: TENANT_DOMAINS.PAYROLL_SIMULATION,
    category: 'intelligence',
    description: 'Motor de simulação de folha com suporte a CCT, adicionais e encargos',
  },
  {
    ...BASE,
    key: 'GOVERNANCE_AI',
    domain: TENANT_DOMAINS.GOVERNANCE_AI,
    category: 'intelligence',
    description: 'IA de governança — recomendações de compliance e análise preditiva',
  },

  // ── 8. Tenant Operations ──
  {
    ...BASE,
    key: 'NOTIFICATIONS',
    domain: TENANT_DOMAINS.NOTIFICATIONS,
    category: 'operations',
    description: 'Notificações in-app com escopo de tenant',
  },
  {
    ...BASE,
    key: 'ADAPTIVE_ONBOARDING',
    domain: TENANT_DOMAINS.ADAPTIVE_ONBOARDING,
    category: 'operations',
    description: 'Onboarding adaptativo baseado em perfil e cargo do colaborador',
  },
  {
    ...BASE,
    key: 'AUTOMATION',
    domain: TENANT_DOMAINS.AUTOMATION,
    category: 'operations',
    description: 'Regras de automação e execução de workflows do tenant',
    tables: ['automation_rules', 'automation_rule_executions'],
  },
  {
    ...BASE,
    key: 'SUPPORT',
    domain: TENANT_DOMAINS.SUPPORT,
    category: 'operations',
    description: 'Chat de suporte e gestão de tickets do tenant',
  },
  {
    ...BASE,
    key: 'GOVERNANCE',
    domain: TENANT_DOMAINS.GOVERNANCE,
    category: 'operations',
    description: 'Governança de acesso e configurações organizacionais',
  },
  {
    ...BASE,
    key: 'INTEGRATION_AUTOMATION',
    domain: TENANT_DOMAINS.INTEGRATION_AUTOMATION,
    category: 'operations',
    description: 'iPaaS — workflows de integração com sistemas externos do tenant',
  },
  {
    ...BASE,
    key: 'MENU_STRUCTURE',
    domain: TENANT_DOMAINS.MENU_STRUCTURE,
    category: 'operations',
    description: 'Estrutura de menus dinâmica baseada em permissões e módulos ativos',
  },
];

// ══════════════════════════════════════════════════════════
// TENANT EVENT BUS
// ══════════════════════════════════════════════════════════

export type TenantLayerEvent =
  // Core HR
  | { type: 'EMPLOYEE_CREATED';            tenantId: string; payload: { employeeId: string } }
  | { type: 'EMPLOYEE_TERMINATED';         tenantId: string; payload: { employeeId: string; reason: string } }

  // Fleet
  | { type: 'VEHICLE_REGISTERED';          tenantId: string; payload: { vehicleId: string; plate: string } }
  | { type: 'GPS_DEVICE_LINKED';           tenantId: string; payload: { deviceId: string; vehicleId: string } }
  | { type: 'BEHAVIOR_RULE_VIOLATED';      tenantId: string; payload: { ruleId: string; driverId: string; severity: string } }
  | { type: 'FLEET_INFRACTION_CREATED';    tenantId: string; payload: { eventId: string; severity: string } }
  | { type: 'FLEET_WARNING_ISSUED';        tenantId: string; payload: { warningId: string; employeeId: string; level: string } }

  // Compliance
  | { type: 'COMPLIANCE_VIOLATION_FOUND';  tenantId: string; payload: { violationId: string; severity: string } }

  // SST
  | { type: 'EPI_DELIVERED';               tenantId: string; payload: { deliveryId: string; employeeId: string } }
  | { type: 'TRAINING_EXPIRED';            tenantId: string; payload: { trainingId: string; employeeId: string; nrCode: string } }
  | { type: 'ASO_SCHEDULED';               tenantId: string; payload: { asoId: string; employeeId: string; examType: string } }
  | { type: 'PCMSO_EXAM_OVERDUE';         tenantId: string; payload: { employeeId: string; daysOverdue: number } }

  // Documents
  | { type: 'AGREEMENT_SIGNED';           tenantId: string; payload: { agreementId: string; employeeId: string } }
  | { type: 'AGREEMENT_EXPIRED';          tenantId: string; payload: { agreementId: string } }

  // Career
  | { type: 'CAREER_PROMOTION_ELIGIBLE';  tenantId: string; payload: { employeeId: string; targetPositionId: string } }

  // Payroll
  | { type: 'PAYROLL_SIMULATED';          tenantId: string; payload: { simulationId: string } };

type TenantLayerEventHandler = (event: TenantLayerEvent) => void;

const tenantLayerHandlers: TenantLayerEventHandler[] = [];

export function emitTenantLayerEvent(event: TenantLayerEvent): void {
  tenantLayerHandlers.forEach(handler => handler(event));
}

export function onTenantLayerEvent(handler: TenantLayerEventHandler): () => void {
  tenantLayerHandlers.push(handler);
  return () => {
    const idx = tenantLayerHandlers.indexOf(handler);
    if (idx >= 0) tenantLayerHandlers.splice(idx, 1);
  };
}

// ══════════════════════════════════════════════════════════
// TENANT ISOLATION CONTRACT
// ══════════════════════════════════════════════════════════

/**
 * Every query in the Tenant Layer MUST include tenant_id filtering.
 * This contract is enforced by:
 *  1. RLS policies on every table (database level)
 *  2. SecurityKernel.buildQueryScope() (application level)
 *  3. This runtime assertion (defense in depth)
 */
export function assertTenantIsolation(tenantId: string | undefined | null): asserts tenantId is string {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.length < 10) {
    throw new TenantIsolationError('tenant_id is required for all Tenant Layer operations');
  }
}

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(`[TenantLayer] ${message}`);
    this.name = 'TenantIsolationError';
  }
}

// ── Guard: validate domain belongs to tenant ──

export function isTenantDomain(domainPath: string): boolean {
  return Object.values(TENANT_DOMAINS).includes(domainPath as any);
}

// ── Helpers ──

export function getCapabilitiesByCategory(category: TenantCapabilityCategory): TenantCapability[] {
  return TENANT_CAPABILITIES.filter(c => c.category === category);
}

export function getTenantDomainCategory(key: TenantDomainKey): TenantCapabilityCategory | undefined {
  return TENANT_CAPABILITIES.find(c => c.key === key)?.category;
}
