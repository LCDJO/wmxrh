/**
 * Labor Rules Engine — Domain Types
 * Regras jurídicas trabalhistas brasileiras (CLT)
 */

// ========================
// ENUMS
// ========================

export type LaborRuleCategory =
  | 'hora_extra' | 'adicional_noturno' | 'insalubridade' | 'periculosidade'
  | 'sobreaviso' | 'plantao' | 'intervalo_intrajornada' | 'dsr'
  | 'ferias' | 'decimo_terceiro' | 'aviso_previo' | 'fgts'
  | 'contribuicao_sindical' | 'vale_transporte' | 'salario_familia'
  | 'licenca_maternidade' | 'licenca_paternidade' | 'piso_salarial'
  | 'reajuste_anual' | 'banco_horas' | 'custom';

export type LaborRuleCalcType = 'percentage' | 'fixed_value' | 'tiered' | 'formula' | 'reference_table';

export type CollectiveAgreementType = 'cct' | 'act';
export type CollectiveAgreementStatus = 'active' | 'expired' | 'pending' | 'cancelled';

// ========================
// ENTITIES
// ========================

export interface LaborRuleSet {
  id: string;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  name: string;
  description: string | null;
  union_name: string | null;
  union_code: string | null;
  uf: string | null;
  categoria_profissional: string | null;
  cct_number: string | null;
  cct_valid_from: string | null;
  cct_valid_until: string | null;
  base_monthly_hours: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LaborRuleDefinition {
  id: string;
  tenant_id: string;
  rule_set_id: string;
  category: LaborRuleCategory;
  name: string;
  description: string | null;
  calc_type: LaborRuleCalcType;
  base_percentage: number | null;
  fixed_value: number | null;
  tiered_config: Record<string, unknown>[] | null;
  formula_expression: string | null;
  clt_article: string | null;
  legal_basis: string | null;
  esocial_rubric_code: string | null;
  integra_inss: boolean;
  integra_irrf: boolean;
  integra_fgts: boolean;
  integra_ferias: boolean;
  integra_13: boolean;
  effective_from: string;
  effective_until: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CollectiveAgreement {
  id: string;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  rule_set_id: string | null;
  agreement_type: CollectiveAgreementType;
  registration_number: string | null;
  union_name: string;
  union_cnpj: string | null;
  employer_union_name: string | null;
  valid_from: string;
  valid_until: string;
  base_date_month: number | null;
  salary_floor: number | null;
  salary_ceiling: number | null;
  annual_readjustment_pct: number | null;
  document_url: string | null;
  status: CollectiveAgreementStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CollectiveAgreementClause {
  id: string;
  tenant_id: string;
  agreement_id: string;
  clause_number: string;
  title: string;
  description: string | null;
  category: LaborRuleCategory | null;
  override_percentage: number | null;
  override_fixed_value: number | null;
  override_config: Record<string, unknown> | null;
  applies_to_rule_id: string | null;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

// ========================
// DTOs
// ========================

export interface CreateLaborRuleSetDTO {
  tenant_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  name: string;
  description?: string | null;
  union_name?: string | null;
  union_code?: string | null;
  uf?: string | null;
  categoria_profissional?: string | null;
  cct_number?: string | null;
  cct_valid_from?: string | null;
  cct_valid_until?: string | null;
  base_monthly_hours?: number;
  created_by?: string | null;
}

export interface CreateLaborRuleDefinitionDTO {
  tenant_id: string;
  rule_set_id: string;
  category: LaborRuleCategory;
  name: string;
  description?: string | null;
  calc_type?: LaborRuleCalcType;
  base_percentage?: number | null;
  fixed_value?: number | null;
  tiered_config?: Record<string, unknown>[] | null;
  formula_expression?: string | null;
  clt_article?: string | null;
  legal_basis?: string | null;
  esocial_rubric_code?: string | null;
  integra_inss?: boolean;
  integra_irrf?: boolean;
  integra_fgts?: boolean;
  integra_ferias?: boolean;
  integra_13?: boolean;
  effective_from?: string;
  effective_until?: string | null;
  is_mandatory?: boolean;
  priority?: number;
}

export interface CreateCollectiveAgreementDTO {
  tenant_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  rule_set_id?: string | null;
  agreement_type?: CollectiveAgreementType;
  registration_number?: string | null;
  union_name: string;
  union_cnpj?: string | null;
  employer_union_name?: string | null;
  valid_from: string;
  valid_until: string;
  base_date_month?: number | null;
  salary_floor?: number | null;
  salary_ceiling?: number | null;
  annual_readjustment_pct?: number | null;
  document_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface CreateCollectiveAgreementClauseDTO {
  tenant_id: string;
  agreement_id: string;
  clause_number: string;
  title: string;
  description?: string | null;
  category?: LaborRuleCategory | null;
  override_percentage?: number | null;
  override_fixed_value?: number | null;
  override_config?: Record<string, unknown> | null;
  applies_to_rule_id?: string | null;
  is_mandatory?: boolean;
}

// ========================
// AGGREGATES
// ========================

export interface LaborRuleSetWithRules extends LaborRuleSet {
  labor_rule_definitions?: LaborRuleDefinition[];
}

export interface CollectiveAgreementWithClauses extends CollectiveAgreement {
  collective_agreement_clauses?: CollectiveAgreementClause[];
  labor_rule_sets?: { name: string } | null;
}
