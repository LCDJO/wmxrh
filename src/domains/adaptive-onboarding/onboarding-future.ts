/**
 * Onboarding Future Capabilities — Preparation stubs.
 *
 * These modules define contracts and placeholder implementations for:
 *
 *   1. AI-Assisted Onboarding  — Conversational guide during setup
 *   2. Segment Templates       — Pre-built flows per industry/market
 *   3. Auto-Import             — Automatic data ingestion from external sources
 *
 * STATUS: Not yet active. Interfaces are stable for future integration.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Future Capabilities (prepared, not active)                     ║
 * ║   ├── OnboardingAIAssistant     ← Guia conversacional IA       ║
 * ║   ├── SegmentTemplateRegistry   ← Templates por segmento       ║
 * ║   └── AutoImportOrchestrator    ← Importação automática        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { PlanTier } from '@/domains/platform-experience/types';
import type { OnboardingFlow, OnboardingStep, TenantSetupConfig } from './types';

// ═══════════════════════════════════════════════════════════════
// 1. AI-ASSISTED ONBOARDING
// ═══════════════════════════════════════════════════════════════

export interface OnboardingAIMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  /** Suggested action the AI recommends */
  suggested_action?: {
    type: 'complete_step' | 'skip_step' | 'navigate' | 'explain';
    step_id?: string;
    route?: string;
  };
}

export interface OnboardingAIAssistantAPI {
  /** Start a conversational onboarding session */
  startSession(tenantId: string, planTier: PlanTier): Promise<OnboardingAIMessage>;
  /** Send a user message and get AI guidance */
  sendMessage(tenantId: string, message: string, context: {
    currentStep: OnboardingStep | null;
    completionPct: number;
  }): Promise<OnboardingAIMessage>;
  /** Get proactive suggestion for the current step */
  getSuggestion(tenantId: string, step: OnboardingStep): Promise<OnboardingAIMessage | null>;
  /** Check if AI assistant is available for this plan */
  isAvailable(planTier: PlanTier): boolean;
}

/** Placeholder implementation — returns static messages */
export function createOnboardingAIAssistant(): OnboardingAIAssistantAPI {
  return {
    async startSession(_tenantId, _planTier) {
      return {
        role: 'assistant',
        content: '👋 Olá! Sou seu assistente de configuração. Vou guiá-lo passo a passo na configuração do seu ambiente. Vamos começar?',
        timestamp: Date.now(),
        suggested_action: { type: 'navigate', route: '/onboarding' },
      };
    },

    async sendMessage(_tenantId, _message, _context) {
      return {
        role: 'assistant',
        content: '🔧 Esta funcionalidade estará disponível em breve. Por enquanto, siga as etapas do onboarding para configurar seu ambiente.',
        timestamp: Date.now(),
      };
    },

    async getSuggestion(_tenantId, step) {
      return {
        role: 'assistant',
        content: `💡 Dica para \"${step.title}\": ${step.description}`,
        timestamp: Date.now(),
        suggested_action: { type: 'complete_step', step_id: step.id },
      };
    },

    isAvailable(planTier) {
      return ['professional', 'enterprise', 'custom'].includes(planTier);
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. SEGMENT TEMPLATES
// ═══════════════════════════════════════════════════════════════

export type MarketSegment =
  | 'varejo'
  | 'industria'
  | 'servicos'
  | 'tecnologia'
  | 'saude'
  | 'educacao'
  | 'construcao'
  | 'agronegocio'
  | 'logistica'
  | 'financeiro'
  | 'governo'
  | 'generic';

export interface SegmentTemplate {
  segment: MarketSegment;
  label: string;
  description: string;
  /** Suggested CNAE codes for this segment */
  suggested_cnaes: string[];
  /** Recommended modules to activate */
  recommended_modules: string[];
  /** Suggested departments to pre-create */
  suggested_departments: string[];
  /** Suggested positions to pre-create */
  suggested_positions: string[];
  /** Specific compliance requirements */
  compliance_focus: string[];
  /** NRs commonly applicable */
  applicable_nrs: number[];
  /** Pre-configured tenant setup */
  default_config: Partial<TenantSetupConfig>;
}

export interface SegmentTemplateRegistryAPI {
  /** List all available segment templates */
  listTemplates(): SegmentTemplate[];
  /** Get template for a specific segment */
  getTemplate(segment: MarketSegment): SegmentTemplate | null;
  /** Auto-detect segment from CNAE code */
  detectSegmentFromCNAE(cnae: string): MarketSegment;
  /** Apply a template to customize the onboarding flow */
  applyTemplate(flow: OnboardingFlow, segment: MarketSegment): OnboardingFlow;
}

const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  {
    segment: 'varejo',
    label: 'Varejo & Comércio',
    description: 'Lojas, supermercados, e-commerce e atacado',
    suggested_cnaes: ['47.11-3', '47.12-1', '47.21-1'],
    recommended_modules: ['employees', 'compensation', 'benefits', 'compliance'],
    suggested_departments: ['Vendas', 'Estoque', 'Administrativo', 'RH', 'Financeiro'],
    suggested_positions: ['Vendedor', 'Caixa', 'Gerente de Loja', 'Estoquista', 'Supervisor'],
    compliance_focus: ['jornada_comercio', 'trabalho_dominical', 'comissoes'],
    applicable_nrs: [1, 5, 6, 17, 24, 26],
    default_config: { primary_use_case: 'hr_management' },
  },
  {
    segment: 'industria',
    label: 'Indústria & Manufatura',
    description: 'Fábricas, metalúrgicas, alimentícias',
    suggested_cnaes: ['10.11-2', '24.11-1', '25.11-0'],
    recommended_modules: ['employees', 'compensation', 'health', 'compliance', 'esocial'],
    suggested_departments: ['Produção', 'Qualidade', 'Manutenção', 'Segurança do Trabalho', 'RH', 'Logística'],
    suggested_positions: ['Operador de Máquinas', 'Técnico de Segurança', 'Supervisor de Produção', 'Engenheiro'],
    compliance_focus: ['insalubridade', 'periculosidade', 'turnos_revezamento', 'cipa'],
    applicable_nrs: [1, 4, 5, 6, 7, 9, 10, 11, 12, 15, 16, 17, 23, 24, 25, 26],
    default_config: { primary_use_case: 'full_suite' },
  },
  {
    segment: 'tecnologia',
    label: 'Tecnologia & SaaS',
    description: 'Software, startups, consultorias de TI',
    suggested_cnaes: ['62.01-5', '62.02-3', '63.11-9'],
    recommended_modules: ['employees', 'compensation', 'benefits'],
    suggested_departments: ['Engenharia', 'Produto', 'Design', 'People', 'Financeiro', 'Comercial'],
    suggested_positions: ['Desenvolvedor', 'Product Manager', 'Designer', 'Tech Lead', 'CTO'],
    compliance_focus: ['home_office', 'banco_horas', 'stock_options'],
    applicable_nrs: [1, 5, 17],
    default_config: { primary_use_case: 'hr_management' },
  },
  {
    segment: 'saude',
    label: 'Saúde & Hospitalar',
    description: 'Hospitais, clínicas, laboratórios',
    suggested_cnaes: ['86.10-1', '86.30-5', '86.40-2'],
    recommended_modules: ['employees', 'compensation', 'health', 'compliance', 'esocial'],
    suggested_departments: ['Enfermagem', 'Corpo Clínico', 'Administrativo', 'Farmácia', 'Laboratório', 'RH'],
    suggested_positions: ['Médico', 'Enfermeiro', 'Técnico de Enfermagem', 'Farmacêutico', 'Recepcionista'],
    compliance_focus: ['insalubridade', 'plantoes', 'jornada_12x36', 'radiacao'],
    applicable_nrs: [1, 5, 6, 7, 9, 15, 17, 24, 26, 32],
    default_config: { primary_use_case: 'full_suite' },
  },
  {
    segment: 'construcao',
    label: 'Construção Civil',
    description: 'Construtoras, empreiteiras, engenharia',
    suggested_cnaes: ['41.20-4', '42.11-1', '43.13-4'],
    recommended_modules: ['employees', 'compensation', 'health', 'compliance', 'esocial'],
    suggested_departments: ['Obras', 'Engenharia', 'Segurança do Trabalho', 'Administrativo', 'RH'],
    suggested_positions: ['Engenheiro Civil', 'Mestre de Obras', 'Pedreiro', 'Eletricista', 'Técnico de Segurança'],
    compliance_focus: ['periculosidade', 'altura', 'nr18', 'epis'],
    applicable_nrs: [1, 4, 5, 6, 7, 9, 10, 11, 12, 15, 16, 17, 18, 21, 24, 26, 35],
    default_config: { primary_use_case: 'full_suite' },
  },
  {
    segment: 'servicos',
    label: 'Serviços Gerais',
    description: 'Consultorias, escritórios, prestadores de serviço',
    suggested_cnaes: ['69.11-7', '70.20-4', '73.11-4'],
    recommended_modules: ['employees', 'compensation', 'benefits'],
    suggested_departments: ['Operações', 'Comercial', 'Administrativo', 'RH', 'Financeiro'],
    suggested_positions: ['Consultor', 'Analista', 'Gerente de Projetos', 'Assistente Administrativo'],
    compliance_focus: ['banco_horas', 'teletrabalho', 'pj_vs_clt'],
    applicable_nrs: [1, 5, 17],
    default_config: { primary_use_case: 'hr_management' },
  },
];

const CNAE_SEGMENT_MAP: Record<string, MarketSegment> = {
  '47': 'varejo', '46': 'varejo',
  '10': 'industria', '24': 'industria', '25': 'industria', '28': 'industria', '29': 'industria',
  '62': 'tecnologia', '63': 'tecnologia',
  '86': 'saude', '87': 'saude',
  '41': 'construcao', '42': 'construcao', '43': 'construcao',
  '01': 'agronegocio', '02': 'agronegocio', '03': 'agronegocio',
  '49': 'logistica', '50': 'logistica', '52': 'logistica',
  '64': 'financeiro', '65': 'financeiro', '66': 'financeiro',
  '85': 'educacao',
  '84': 'governo',
};

export function createSegmentTemplateRegistry(): SegmentTemplateRegistryAPI {
  return {
    listTemplates() {
      return [...SEGMENT_TEMPLATES];
    },

    getTemplate(segment) {
      return SEGMENT_TEMPLATES.find(t => t.segment === segment) ?? null;
    },

    detectSegmentFromCNAE(cnae: string): MarketSegment {
      const prefix2 = cnae.replace(/\D/g, '').substring(0, 2);
      return CNAE_SEGMENT_MAP[prefix2] ?? 'generic';
    },

    applyTemplate(flow, segment) {
      // Future: reorder/add steps based on segment priorities
      // For now, return flow unchanged with segment metadata
      return { ...flow };
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. AUTO-IMPORT ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

export type ImportSource =
  | 'csv'
  | 'xlsx'
  | 'google_sheets'
  | 'esocial_xml'
  | 'other_system_api';

export type ImportEntity =
  | 'employees'
  | 'departments'
  | 'positions'
  | 'companies'
  | 'benefits'
  | 'payroll_items';

export interface ImportMapping {
  source_column: string;
  target_field: string;
  transform?: 'uppercase' | 'lowercase' | 'trim' | 'cpf_format' | 'date_br' | 'currency_br';
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  source: ImportSource;
  entity: ImportEntity;
  status: 'pending' | 'validating' | 'importing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  mappings: ImportMapping[];
  created_at: number;
  completed_at: number | null;
}

export interface AutoImportOrchestratorAPI {
  /** Get supported import sources */
  getSupportedSources(): ImportSource[];
  /** Get importable entities */
  getImportableEntities(): ImportEntity[];
  /** Validate a file/data before import */
  validateImport(tenantId: string, source: ImportSource, entity: ImportEntity, data: unknown): Promise<{
    valid: boolean;
    row_count: number;
    detected_mappings: ImportMapping[];
    warnings: string[];
  }>;
  /** Start an import job */
  startImport(tenantId: string, job: Omit<ImportJob, 'id' | 'status' | 'processed_rows' | 'error_rows' | 'errors' | 'created_at' | 'completed_at'>): Promise<ImportJob>;
  /** Check if auto-import is available for this plan */
  isAvailable(planTier: PlanTier): boolean;
}

export function createAutoImportOrchestrator(): AutoImportOrchestratorAPI {
  return {
    getSupportedSources() {
      return ['csv', 'xlsx', 'google_sheets', 'esocial_xml', 'other_system_api'];
    },

    getImportableEntities() {
      return ['employees', 'departments', 'positions', 'companies', 'benefits', 'payroll_items'];
    },

    async validateImport(_tenantId, _source, _entity, _data) {
      return {
        valid: false,
        row_count: 0,
        detected_mappings: [],
        warnings: ['Auto-import não está disponível ainda. Funcionalidade em desenvolvimento.'],
      };
    },

    async startImport(tenantId, jobConfig) {
      return {
        id: `import_${Date.now()}`,
        ...jobConfig,
        tenant_id: tenantId,
        status: 'pending' as const,
        processed_rows: 0,
        error_rows: 0,
        errors: [],
        created_at: Date.now(),
        completed_at: null,
      };
    },

    isAvailable(planTier) {
      return ['enterprise', 'custom'].includes(planTier);
    },
  };
}
