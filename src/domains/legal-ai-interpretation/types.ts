/**
 * Legal AI Interpretation Engine — Types
 *
 * Bounded Context: interprets legislative changes detected by
 * Regulatory Intelligence and produces actionable guidance.
 *
 * Integrations:
 *  - Regulatory Intelligence Engine (input: norm changes, diffs)
 *  - Career & Legal Intelligence Engine (positions, CBO)
 *  - Occupational Intelligence Engine (risk mapping)
 *  - NR Training Lifecycle Engine (training requirements)
 *  - Labor Compliance / PCMSO / PGR (health programs)
 *  - Workforce Intelligence Engine (headcount, analytics)
 *  - Safety Automation Engine (playbooks, corrective actions)
 *  - Government Integration Gateway (eSocial, DOU)
 *  - Security Kernel (audit, RBAC)
 */

// ── Enums / Literals ──

export type InterpretationStatus = 'draft' | 'reviewed' | 'approved' | 'published' | 'archived';
export type ActionPriority = 'imediata' | 'curto_prazo' | 'medio_prazo' | 'longo_prazo';
export type ActionComplexity = 'simples' | 'moderada' | 'complexa' | 'critica';
export type WorkflowType =
  | 'update_training'
  | 'update_epi'
  | 'update_health_program'
  | 'update_risk_mapping'
  | 'recalculate_payroll'
  | 'update_salary_floor'
  | 'update_agreement'
  | 'notify_stakeholders'
  | 'audit_compliance'
  | 'custom';

export type ImpactLevel = 'nenhum' | 'baixo' | 'moderado' | 'alto' | 'critico';

export type InterpretationConfidence = 'alta' | 'media' | 'baixa' | 'requer_validacao_humana';

// ── Core Entities ──

/** Executive summary of a legislative change */
export interface ExecutiveSummary {
  norm_codigo: string;
  norm_titulo: string;
  resumo: string;
  pontos_chave: string[];
  data_vigencia: string;
  orgao_emissor: string;
  impacto_geral: ImpactLevel;
  setores_afetados: string[];
  prazo_adequacao_dias: number | null;
  confianca: InterpretationConfidence;
  generated_at: string;
}

/** Practical interpretation of how a change affects operations */
export interface PracticalInterpretation {
  id: string;
  norm_codigo: string;
  contexto_legal: string;
  interpretacao: string;
  implicacoes_praticas: PracticalImplication[];
  riscos_nao_conformidade: NonComplianceRisk[];
  referencias_legais: LegalReference[];
  status: InterpretationStatus;
  revisado_por: string | null;
  confianca: InterpretationConfidence;
  generated_at: string;
}

export interface PracticalImplication {
  area: string;
  descricao: string;
  acao_necessaria: boolean;
  prazo_dias: number | null;
  departamentos_envolvidos: string[];
}

export interface NonComplianceRisk {
  descricao: string;
  severidade: ImpactLevel;
  multa_estimada: string | null;
  base_legal: string;
  probabilidade: 'baixa' | 'media' | 'alta';
}

export interface LegalReference {
  codigo: string;
  artigo: string | null;
  descricao: string;
  url: string | null;
}

/** Impact analysis per position/cargo */
export interface PositionImpactAnalysis {
  cargo_id: string;
  cargo_nome: string;
  cbo_codigo: string | null;
  company_id: string;
  company_name: string;
  nivel_impacto: ImpactLevel;
  areas_afetadas: PositionImpactArea[];
  funcionarios_afetados: number;
  acoes_necessarias: string[];
  prazo_adequacao_dias: number | null;
  custo_estimado: CostEstimate | null;
}

export interface PositionImpactArea {
  area: string;
  descricao: string;
  requisito_anterior: string | null;
  requisito_novo: string;
  gap_identificado: boolean;
}

export interface CostEstimate {
  valor_minimo: number;
  valor_maximo: number;
  moeda: 'BRL';
  componentes: { item: string; valor: number }[];
}

/** Action plan generated from interpretation */
export interface ActionPlan {
  id: string;
  norm_codigo: string;
  titulo: string;
  descricao: string;
  prioridade: ActionPriority;
  complexidade: ActionComplexity;
  etapas: ActionStep[];
  responsaveis_sugeridos: string[];
  prazo_total_dias: number;
  custo_estimado: CostEstimate | null;
  dependencias: string[];
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  generated_at: string;
}

export interface ActionStep {
  ordem: number;
  titulo: string;
  descricao: string;
  responsavel_tipo: 'rh' | 'sst' | 'juridico' | 'gestao' | 'ti' | 'financeiro';
  prazo_dias: number;
  entregavel: string;
  automatizavel: boolean;
  workflow_type: WorkflowType | null;
}

/** Generated workflow specification */
export interface GeneratedWorkflow {
  id: string;
  action_plan_id: string;
  action_step_ordem: number;
  workflow_type: WorkflowType;
  titulo: string;
  descricao: string;
  trigger_event: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  input_params: Record<string, unknown>;
  estimated_duration_minutes: number;
  requires_approval: boolean;
  generated_at: string;
}

export interface WorkflowNode {
  id: string;
  type: 'start' | 'action' | 'condition' | 'notification' | 'approval' | 'end';
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition: string | null;
}

// ── Engine Inputs ──

export interface InterpretationInput {
  tenant_id: string;
  norm_codigo: string;
  norm_titulo: string;
  orgao_emissor: string;
  data_publicacao: string;
  data_vigencia: string;
  texto_alteracao: string;
  diff_summary: DiffSummaryInput | null;
  areas_impactadas: string[];
}

export interface DiffSummaryInput {
  artigos_alterados: number;
  artigos_adicionados: number;
  artigos_revogados: number;
  gravidade: string;
  areas_impacto: string[];
  mudancas_chave: string[];
}

export interface PositionImpactInput {
  tenant_id: string;
  norm_codigo: string;
  areas_impactadas: string[];
  positions: PositionSnapshot[];
  companies: CompanySnapshot[];
}

export interface PositionSnapshot {
  id: string;
  nome: string;
  cbo_codigo: string | null;
  company_id: string;
  nr_codigos: string[];
  exige_epi: boolean;
  exige_exame_medico: boolean;
  funcionarios_count: number;
}

export interface CompanySnapshot {
  id: string;
  name: string;
  cnae_principal: string | null;
  grau_risco: number;
}

export interface ActionPlanInput {
  tenant_id: string;
  summary: ExecutiveSummary;
  interpretation: PracticalInterpretation;
  position_impacts: PositionImpactAnalysis[];
}

export interface WorkflowGenerationInput {
  tenant_id: string;
  action_plan: ActionPlan;
  step: ActionStep;
}

// ── Engine Outputs ──

export interface InterpretationResult {
  summary: ExecutiveSummary;
  interpretation: PracticalInterpretation;
  success: boolean;
  errors: string[];
}

export interface PositionImpactResult {
  impacts: PositionImpactAnalysis[];
  total_positions_affected: number;
  total_employees_affected: number;
  highest_impact: ImpactLevel;
  cost_estimate_total: CostEstimate | null;
}

export interface ActionPlanResult {
  plan: ActionPlan;
  total_steps: number;
  automatable_steps: number;
  estimated_total_days: number;
}

export interface WorkflowGenerationResult {
  workflows: GeneratedWorkflow[];
  total_generated: number;
  requires_approval_count: number;
}
