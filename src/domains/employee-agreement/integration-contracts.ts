/**
 * Legal Agreements Governance Engine — Integration Contracts
 *
 * Typed contracts defining how external engines trigger
 * agreement workflows via the governance orchestrator.
 *
 * Integrated Engines:
 *   1. Employee Master Record Engine  → profile changes, department transfer
 *   2. Career & Legal Intelligence    → CBO/NR requirements, position risk
 *   3. Automated Hiring Workflow      → admission compliance gate
 *   4. EPI Lifecycle Engine           → EPI delivery terms
 *   5. Fleet Compliance Engine        → vehicle use authorization
 *   6. NR Training Lifecycle Engine   → training acknowledgment terms
 *   7. Security Kernel                → permission validation, audit
 *   8. DocumentVault                  → signed document storage
 */

// ── Cross-Engine Trigger Types ──

export type GovernanceTriggerSource =
  | 'hiring_workflow'
  | 'career_engine'
  | 'epi_lifecycle'
  | 'fleet_compliance'
  | 'nr_training'
  | 'employee_record'
  | 'manual';

/**
 * Inbound event from Automated Hiring Workflow Engine.
 * Triggers mandatory terms dispatch as a compliance gate step.
 */
export interface HiringWorkflowTrigger {
  source: 'hiring_workflow';
  event: 'admission_started' | 'compliance_gate_check' | 'activation_requested';
  employee_id: string;
  company_id: string;
  cargo_id: string | null;
  department_id?: string | null;
  hiring_workflow_id?: string;
}

/**
 * Inbound event from Career & Legal Intelligence Engine.
 * Triggers position-specific terms on promotion/transfer.
 */
export interface CareerEngineTrigger {
  source: 'career_engine';
  event: 'position_changed' | 'promotion_approved' | 'transfer_completed' | 'risk_level_changed';
  employee_id: string;
  company_id: string;
  old_cargo_id?: string | null;
  new_cargo_id: string;
  department_id?: string | null;
  cbo_codigo?: string | null;
  risk_level?: number;
}

/**
 * Inbound event from EPI Lifecycle Engine.
 * Triggers EPI delivery/receipt terms.
 */
export interface EPILifecycleTrigger {
  source: 'epi_lifecycle';
  event: 'epi_delivered' | 'epi_replaced' | 'epi_batch_delivery';
  employee_id: string;
  company_id: string;
  epi_items: Array<{
    epi_id: string;
    nome: string;
    ca_number?: string;
  }>;
  delivery_id?: string;
}

/**
 * Inbound event from Fleet Compliance Engine.
 * Triggers vehicle use authorization terms.
 */
export interface FleetComplianceTrigger {
  source: 'fleet_compliance';
  event: 'vehicle_assigned' | 'fleet_policy_updated' | 'driver_authorized';
  employee_id: string;
  company_id: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  cnh_category?: string;
}

/**
 * Inbound event from NR Training Lifecycle Engine.
 * Triggers training acknowledgment / responsibility terms.
 */
export interface NRTrainingTrigger {
  source: 'nr_training';
  event: 'training_completed' | 'training_expired' | 'certification_renewed';
  employee_id: string;
  company_id: string;
  nr_code: string;
  training_id?: string;
  certification_id?: string;
  valid_until?: string;
}

/**
 * Inbound event from Employee Master Record Engine.
 * Triggers terms on profile changes (department transfer, contract renewal).
 */
export interface EmployeeRecordTrigger {
  source: 'employee_record';
  event: 'department_transferred' | 'contract_renewed' | 'data_updated' | 'reactivated';
  employee_id: string;
  company_id: string;
  cargo_id?: string | null;
  department_id?: string | null;
  old_department_id?: string | null;
}

/**
 * Union of all cross-engine triggers.
 */
export type GovernanceTrigger =
  | HiringWorkflowTrigger
  | CareerEngineTrigger
  | EPILifecycleTrigger
  | FleetComplianceTrigger
  | NRTrainingTrigger
  | EmployeeRecordTrigger;

// ── Governance Result ──

export interface GovernanceDispatchResult {
  trigger_source: GovernanceTriggerSource;
  trigger_event: string;
  employee_id: string;
  templates_matched: number;
  dispatched: number;
  skipped_existing: number;
  errors: string[];
  compliance_status: 'compliant' | 'pending' | 'blocked';
}

// ── Compliance Gate Contract ──

/**
 * Returned by the governance orchestrator when the hiring workflow
 * requests a compliance gate check.
 */
export interface ComplianceGateResult {
  employee_id: string;
  all_mandatory_signed: boolean;
  total_mandatory: number;
  signed: number;
  pending: number;
  missing_templates: Array<{
    template_id: string;
    nome_termo: string;
    tipo: string;
    status: 'not_assigned' | 'pending' | 'sent' | 'rejected' | 'expired';
  }>;
  can_activate: boolean;
  blocking_reasons: string[];
}

// ── Template Matching Rules ──

/**
 * Rules used by the orchestrator to match templates to triggers.
 */
export interface TemplateMatchRule {
  /** Match templates of this tipo */
  tipos: string[];
  /** Match templates with specific cargo_id */
  cargo_id?: string | null;
  /** Match templates with category containing keywords */
  category_keywords?: string[];
  /** Only mandatory templates */
  mandatory_only: boolean;
  /** Include global (no cargo restriction) templates */
  include_global: boolean;
}

/**
 * Maps trigger events to template matching rules.
 */
export const TRIGGER_MATCH_RULES: Record<string, TemplateMatchRule> = {
  // Hiring → all mandatory general + position-specific + LGPD
  'hiring_workflow:admission_started': {
    tipos: ['geral', 'contrato', 'confidencialidade', 'uso_imagem', 'lgpd', 'funcao'],
    mandatory_only: true,
    include_global: true,
  },
  'hiring_workflow:compliance_gate_check': {
    tipos: ['geral', 'contrato', 'confidencialidade', 'uso_imagem', 'epi', 'lgpd', 'funcao', 'risco'],
    mandatory_only: true,
    include_global: true,
  },
  'hiring_workflow:activation_requested': {
    tipos: ['geral', 'contrato', 'confidencialidade', 'uso_imagem', 'epi', 'lgpd', 'funcao', 'risco', 'veiculo', 'gps'],
    mandatory_only: true,
    include_global: true,
  },
  // Career → position-specific only
  'career_engine:position_changed': {
    tipos: ['funcao', 'contrato'],
    mandatory_only: true,
    include_global: false,
  },
  'career_engine:promotion_approved': {
    tipos: ['funcao', 'contrato'],
    mandatory_only: true,
    include_global: false,
  },
  'career_engine:risk_level_changed': {
    tipos: ['risco', 'epi'],
    mandatory_only: true,
    include_global: false,
  },
  // EPI → EPI-specific terms
  'epi_lifecycle:epi_delivered': {
    tipos: ['epi', 'risco'],
    category_keywords: ['epi', 'equipamento', 'protecao'],
    mandatory_only: true,
    include_global: false,
  },
  'epi_lifecycle:epi_batch_delivery': {
    tipos: ['epi', 'risco'],
    category_keywords: ['epi', 'equipamento', 'protecao'],
    mandatory_only: true,
    include_global: false,
  },
  // Fleet → vehicle authorization terms
  'fleet_compliance:vehicle_assigned': {
    tipos: ['veiculo', 'gps'],
    category_keywords: ['veicular', 'frota', 'direcao', 'veiculo', 'gps'],
    mandatory_only: true,
    include_global: false,
  },
  'fleet_compliance:driver_authorized': {
    tipos: ['veiculo', 'gps'],
    category_keywords: ['veicular', 'frota', 'direcao', 'veiculo'],
    mandatory_only: true,
    include_global: false,
  },
  // NR Training → training acknowledgment terms
  'nr_training:training_completed': {
    tipos: ['risco', 'epi', 'disciplinar'],
    category_keywords: ['treinamento', 'nr', 'seguranca', 'capacitacao'],
    mandatory_only: true,
    include_global: false,
  },
  // Employee Record → department-specific / contract terms
  'employee_record:department_transferred': {
    tipos: ['funcao', 'contrato'],
    mandatory_only: true,
    include_global: false,
  },
  'employee_record:contract_renewed': {
    tipos: ['geral', 'contrato', 'confidencialidade'],
    mandatory_only: true,
    include_global: true,
  },
  'employee_record:reactivated': {
    tipos: ['geral', 'contrato', 'confidencialidade', 'lgpd'],
    mandatory_only: true,
    include_global: true,
  },
};
