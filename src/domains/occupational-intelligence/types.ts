/**
 * Occupational Intelligence Engine — Types
 *
 * Core types for CNAE classification, CBO mapping,
 * NR training requirements and compliance recommendations.
 */

// ========================
// CNAE & Risk Classification
// ========================

/** Grau de Risco conforme NR-4 (1 a 4) */
export type GrauRisco = 1 | 2 | 3 | 4;

export interface CnaeInfo {
  code: string;            // e.g. "10.11-2"
  description: string;
  division: string;        // First 2 digits
  group: string;           // First 3 digits
  grau_risco: GrauRisco;
  requires_sesmt: boolean; // NR-4
  requires_cipa: boolean;  // NR-5
}

export interface CnaeRiskProfile {
  cnae: CnaeInfo;
  risk_categories: RiskCategoryMapping[];
  applicable_nrs: NrRequirement[];
  suggested_cbos: CboSuggestion[];
  training_requirements: TrainingRequirement[];
  compliance_score: number; // 0-100
}

// ========================
// CBO (Classificação Brasileira de Ocupações)
// ========================

export interface CboInfo {
  code: string;           // e.g. "2521-05"
  title: string;
  family: string;
  description: string;
}

export interface CboSuggestion {
  cbo: CboInfo;
  relevance: number;      // 0-1 probability
  reason: string;
  typical_cnae_codes: string[];
}

// ========================
// NR (Normas Regulamentadoras)
// ========================

export type NrPriority = 'obrigatoria' | 'condicional' | 'recomendada';
export type TrainingPeriodicity = 'admissional' | 'periodico' | 'reciclagem' | 'eventual';

export interface NrRequirement {
  nr_number: number;
  nr_title: string;
  description: string;
  priority: NrPriority;
  applies_to_grau_risco: GrauRisco[];
  conditions: string | null;
}

export interface TrainingRequirement {
  nr_number: number;
  training_name: string;
  workload_hours: number;
  periodicity: TrainingPeriodicity;
  validity_months: number | null;
  target_cbos: string[];   // CBO codes that need this
  priority: NrPriority;
  legal_basis: string;
}

// ========================
// Risk Category Mapping
// ========================

export type OccupationalRiskType = 'fisico' | 'quimico' | 'biologico' | 'ergonomico' | 'acidente';

export interface RiskCategoryMapping {
  risk_type: OccupationalRiskType;
  probability: number;     // 0-1
  typical_agents: string[];
  mitigation_nrs: number[];
}

// ========================
// Compliance Recommendations
// ========================

export type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'acknowledged' | 'implemented' | 'dismissed';

export interface ComplianceRecommendation {
  id: string;
  category: 'training' | 'documentation' | 'program' | 'equipment' | 'monitoring';
  severity: RecommendationSeverity;
  title: string;
  description: string;
  legal_basis: string;
  nr_reference: number | null;
  deadline_days: number | null;
  status: RecommendationStatus;
  created_at: string;
}

// ========================
// Service Input/Output
// ========================

export interface AnalyzeCompanyInput {
  cnae_code: string;
  employee_count?: number;
  company_id?: string;
  tenant_id?: string;
}

export interface OccupationalAnalysisResult {
  cnae_profile: CnaeRiskProfile;
  recommendations: ComplianceRecommendation[];
  summary: OccupationalSummary;
}

export interface OccupationalSummary {
  total_trainings_required: number;
  total_nrs_applicable: number;
  total_cbos_suggested: number;
  estimated_compliance_cost_hours: number;
  risk_level_label: string;
  requires_sesmt: boolean;
  requires_cipa: boolean;
}
