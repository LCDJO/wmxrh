/**
 * Career & Legal Intelligence Engine — Types
 */

// ── Career Position (PCCS) ──
export type CareerNivel = 'junior' | 'pleno' | 'senior' | 'lider' | 'especialista';
export type TrilhaTipo = 'tecnica' | 'gestao' | 'especialista' | 'mista';
export type LegalRequirementType = 'nr_training' | 'exame_medico' | 'certificacao' | 'licenca' | 'epi' | 'formacao';
export type RiscoNivel = 'baixo' | 'medio' | 'alto' | 'critico';
export type BenchmarkFonte = 'interno' | 'mercado' | 'cct' | 'piso_legal';
export type AlertaTipo = 'salario_abaixo_piso' | 'treinamento_vencido' | 'exame_vencido' | 'certificacao_ausente' | 'epi_pendente' | 'desvio_funcao';

export interface CareerPosition {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  position_id: string | null;
  nome: string;
  cbo_codigo: string | null;
  nivel: CareerNivel;
  descricao: string | null;
  faixa_salarial_min: number;
  faixa_salarial_max: number;
  formacao_minima: string | null;
  certificacoes_exigidas: string[];
  tempo_experiencia_meses: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CareerPath {
  id: string;
  tenant_id: string;
  company_id: string | null;
  nome: string;
  descricao: string | null;
  trilha_tipo: TrilhaTipo;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareerPathStep {
  id: string;
  tenant_id: string;
  career_path_id: string;
  career_position_id: string;
  ordem: number;
  tempo_minimo_meses: number;
  requisitos_transicao: string | null;
  created_at: string;
}

export interface CareerLegalRequirement {
  id: string;
  tenant_id: string;
  career_position_id: string;
  tipo: LegalRequirementType;
  codigo_referencia: string | null;
  descricao: string;
  obrigatorio: boolean;
  periodicidade_meses: number | null;
  base_legal: string | null;
  risco_nao_conformidade: RiscoNivel;
  created_at: string;
  updated_at: string;
}

export interface CareerSalaryBenchmark {
  id: string;
  tenant_id: string;
  career_position_id: string;
  fonte: BenchmarkFonte;
  valor_minimo: number;
  valor_mediano: number;
  valor_maximo: number;
  referencia_data: string;
  observacao: string | null;
  created_at: string;
}

export interface CareerRiskAlert {
  id: string;
  tenant_id: string;
  career_position_id: string | null;
  employee_id: string | null;
  tipo_alerta: AlertaTipo;
  severidade: RiscoNivel;
  descricao: string;
  resolvido: boolean;
  resolvido_em: string | null;
  resolvido_por: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── DTOs ──
export interface CreateCareerPositionDTO {
  tenant_id: string;
  company_id: string;
  company_group_id?: string | null;
  position_id?: string | null;
  nome: string;
  cbo_codigo?: string | null;
  nivel?: CareerNivel;
  descricao?: string | null;
  faixa_salarial_min?: number;
  faixa_salarial_max?: number;
  formacao_minima?: string | null;
  certificacoes_exigidas?: string[];
  tempo_experiencia_meses?: number;
}

export interface CreateCareerPathDTO {
  tenant_id: string;
  company_id?: string | null;
  nome: string;
  descricao?: string | null;
  trilha_tipo?: TrilhaTipo;
}

export interface CreateCareerPathStepDTO {
  tenant_id: string;
  career_path_id: string;
  career_position_id: string;
  ordem: number;
  tempo_minimo_meses?: number;
  requisitos_transicao?: string | null;
}

export interface CreateCareerLegalRequirementDTO {
  tenant_id: string;
  career_position_id: string;
  tipo: LegalRequirementType;
  codigo_referencia?: string | null;
  descricao: string;
  obrigatorio?: boolean;
  periodicidade_meses?: number | null;
  base_legal?: string | null;
  risco_nao_conformidade?: RiscoNivel;
}

export interface CreateCareerSalaryBenchmarkDTO {
  tenant_id: string;
  career_position_id: string;
  fonte?: BenchmarkFonte;
  valor_minimo: number;
  valor_mediano: number;
  valor_maximo: number;
  referencia_data?: string;
  observacao?: string | null;
}

export interface CreateCareerRiskAlertDTO {
  tenant_id: string;
  career_position_id?: string | null;
  employee_id?: string | null;
  tipo_alerta: AlertaTipo;
  severidade?: RiscoNivel;
  descricao: string;
  metadata?: Record<string, unknown>;
}

// ── Enriched Views ──
export interface CareerPositionWithRelations extends CareerPosition {
  legal_requirements: CareerLegalRequirement[];
  salary_benchmarks: CareerSalaryBenchmark[];
  risk_alerts: CareerRiskAlert[];
}

export interface CareerPathWithSteps extends CareerPath {
  steps: (CareerPathStep & { position: CareerPosition })[];
}

// ── Analysis Results ──
export interface CareerComplianceAnalysis {
  position_id: string;
  position_name: string;
  total_requirements: number;
  met_requirements: number;
  pending_requirements: number;
  compliance_score: number; // 0-100
  critical_gaps: string[];
  risk_level: RiscoNivel;
}

export interface SalaryPositioningResult {
  position_id: string;
  position_name: string;
  current_min: number;
  current_max: number;
  benchmark_median: number;
  gap_percentage: number;
  positioning: 'abaixo' | 'adequado' | 'acima';
  alert: boolean;
}

// ── Legal Knowledge Base ──
export type LegalReferenceTipo = 'NR' | 'CLT' | 'CCT' | 'Portaria';

export interface LegalReference {
  id: string;
  tenant_id: string;
  tipo: LegalReferenceTipo;
  codigo_referencia: string;
  resumo: string | null;
  obrigatoriedade: boolean;
  categoria_profissional: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLegalReferenceDTO {
  tenant_id: string;
  tipo: LegalReferenceTipo;
  codigo_referencia: string;
  resumo?: string | null;
  obrigatoriedade?: boolean;
  categoria_profissional?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
}

// ── Career Legal Mapping (Cargo → Legislação) ──
export type AdicionalAplicavel = 'insalubridade' | 'periculosidade';

export interface CareerLegalMapping {
  id: string;
  tenant_id: string;
  career_position_id: string;
  legal_reference_id: string | null;
  nr_codigo: string | null;
  exige_treinamento: boolean;
  exige_exame_medico: boolean;
  exige_epi: boolean;
  adicional_aplicavel: AdicionalAplicavel | null;
  piso_salarial_referencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCareerLegalMappingDTO {
  tenant_id: string;
  career_position_id: string;
  legal_reference_id?: string | null;
  nr_codigo?: string | null;
  exige_treinamento?: boolean;
  exige_exame_medico?: boolean;
  exige_epi?: boolean;
  adicional_aplicavel?: AdicionalAplicavel | null;
  piso_salarial_referencia?: string | null;
}
