/**
 * Standard Brazilian Legal Rubric Library
 *
 * Pre-configured CLT labor rule definitions that can be seeded
 * into any tenant's rule set. These represent the minimum legal
 * requirements under Brazilian labor law.
 *
 * Used by:
 *   - Tenant onboarding (auto-create standard rules)
 *   - Labor Rules UI (template selector)
 *   - eSocial S-1010 mapping
 */

import type { CreateLaborRuleDefinitionDTO, LaborRuleCategory, LaborRuleCalcType } from './types';

export interface RubricTemplate {
  category: LaborRuleCategory;
  name: string;
  description: string;
  calc_type: LaborRuleCalcType;
  base_percentage: number | null;
  fixed_value: number | null;
  clt_article: string;
  legal_basis: string;
  esocial_rubric_code: string;
  integra_inss: boolean;
  integra_irrf: boolean;
  integra_fgts: boolean;
  integra_ferias: boolean;
  integra_13: boolean;
  integra_dsr: boolean;
  aplica_reflexos: boolean;
  is_mandatory: boolean;
  priority: number;
}

/**
 * Standard Brazilian CLT rubric templates.
 * These cover the legally required calculations.
 */
export const STANDARD_RUBRIC_LIBRARY: RubricTemplate[] = [
  // ── HORA EXTRA ──
  {
    category: 'hora_extra',
    name: 'Hora Extra 50%',
    description: 'Adicional de hora extra em dia útil — mínimo 50%',
    calc_type: 'percentage',
    base_percentage: 50,
    fixed_value: null,
    clt_article: 'Art. 59',
    legal_basis: 'CLT Art. 59 — Horas suplementares com acréscimo de no mínimo 50%',
    esocial_rubric_code: '1003',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: true,
    aplica_reflexos: true, is_mandatory: true, priority: 10,
  },
  {
    category: 'hora_extra',
    name: 'Hora Extra 100%',
    description: 'Adicional de hora extra em domingos e feriados — 100%',
    calc_type: 'percentage',
    base_percentage: 100,
    fixed_value: null,
    clt_article: 'Art. 59-A',
    legal_basis: 'CLT Art. 59-A — Trabalho em domingos e feriados com acréscimo de 100%',
    esocial_rubric_code: '1004',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: true,
    aplica_reflexos: true, is_mandatory: true, priority: 11,
  },

  // ── ADICIONAL NOTURNO ──
  {
    category: 'adicional_noturno',
    name: 'Adicional Noturno 20%',
    description: 'Adicional noturno mínimo legal — 20% sobre hora diurna com hora reduzida (52:30)',
    calc_type: 'percentage',
    base_percentage: 20,
    fixed_value: null,
    clt_article: 'Art. 73',
    legal_basis: 'CLT Art. 73 — Trabalho noturno (22h–5h) com acréscimo mínimo de 20%',
    esocial_rubric_code: '1005',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: true,
    aplica_reflexos: true, is_mandatory: true, priority: 20,
  },

  // ── INSALUBRIDADE ──
  {
    category: 'insalubridade',
    name: 'Insalubridade — Grau Mínimo (10%)',
    description: 'Adicional de insalubridade grau mínimo',
    calc_type: 'percentage',
    base_percentage: 10,
    fixed_value: null,
    clt_article: 'Art. 192',
    legal_basis: 'CLT Art. 192 — Grau mínimo: 10% do salário mínimo',
    esocial_rubric_code: '1006',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 30,
  },
  {
    category: 'insalubridade',
    name: 'Insalubridade — Grau Médio (20%)',
    description: 'Adicional de insalubridade grau médio',
    calc_type: 'percentage',
    base_percentage: 20,
    fixed_value: null,
    clt_article: 'Art. 192',
    legal_basis: 'CLT Art. 192 — Grau médio: 20% do salário mínimo',
    esocial_rubric_code: '1007',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 31,
  },
  {
    category: 'insalubridade',
    name: 'Insalubridade — Grau Máximo (40%)',
    description: 'Adicional de insalubridade grau máximo',
    calc_type: 'percentage',
    base_percentage: 40,
    fixed_value: null,
    clt_article: 'Art. 192',
    legal_basis: 'CLT Art. 192 — Grau máximo: 40% do salário mínimo',
    esocial_rubric_code: '1008',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 32,
  },

  // ── PERICULOSIDADE ──
  {
    category: 'periculosidade',
    name: 'Periculosidade 30%',
    description: 'Adicional de periculosidade — 30% sobre salário base',
    calc_type: 'percentage',
    base_percentage: 30,
    fixed_value: null,
    clt_article: 'Art. 193',
    legal_basis: 'CLT Art. 193 — Atividades perigosas: 30% sobre salário base',
    esocial_rubric_code: '1009',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 40,
  },

  // ── SOBREAVISO ──
  {
    category: 'sobreaviso',
    name: 'Sobreaviso (1/3 hora normal)',
    description: 'Remuneração de sobreaviso — 1/3 do valor da hora normal',
    calc_type: 'percentage',
    base_percentage: 33.33,
    fixed_value: null,
    clt_article: 'Art. 244 §2º',
    legal_basis: 'CLT Art. 244 §2º — Sobreaviso: 1/3 da hora normal por hora de sobreaviso',
    esocial_rubric_code: '1010',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: true,
    aplica_reflexos: true, is_mandatory: false, priority: 50,
  },

  // ── DSR ──
  {
    category: 'dsr',
    name: 'DSR — Reflexo sobre Variáveis',
    description: 'Descanso Semanal Remunerado — reflexo sobre verbas variáveis',
    calc_type: 'formula',
    base_percentage: null,
    fixed_value: null,
    clt_article: 'Lei 605/49',
    legal_basis: 'Lei 605/49 Art. 7º — DSR = (total variáveis / dias úteis) × domingos e feriados',
    esocial_rubric_code: '1011',
    integra_inss: true, integra_irrf: true, integra_fgts: true,
    integra_ferias: true, integra_13: true, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 60,
  },

  // ── VALE TRANSPORTE ──
  {
    category: 'vale_transporte',
    name: 'Desconto Vale Transporte (6%)',
    description: 'Desconto legal do vale transporte — 6% do salário base',
    calc_type: 'percentage',
    base_percentage: 6,
    fixed_value: null,
    clt_article: 'Lei 7.418/85',
    legal_basis: 'Lei 7.418/85 Art. 4º §único — Desconto de até 6% do salário base',
    esocial_rubric_code: '9201',
    integra_inss: false, integra_irrf: false, integra_fgts: false,
    integra_ferias: false, integra_13: false, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 70,
  },

  // ── FGTS ──
  {
    category: 'fgts',
    name: 'FGTS Patronal (8%)',
    description: 'Recolhimento patronal do FGTS — 8% sobre remuneração',
    calc_type: 'percentage',
    base_percentage: 8,
    fixed_value: null,
    clt_article: 'Lei 8.036/90',
    legal_basis: 'Lei 8.036/90 Art. 15 — Depósito mensal de 8% da remuneração',
    esocial_rubric_code: '9202',
    integra_inss: false, integra_irrf: false, integra_fgts: false,
    integra_ferias: false, integra_13: false, integra_dsr: false,
    aplica_reflexos: false, is_mandatory: true, priority: 80,
  },
];

/**
 * Convert a template to a CreateLaborRuleDefinitionDTO
 * ready for insertion into a specific rule set.
 */
export function templateToDTO(
  template: RubricTemplate,
  tenantId: string,
  ruleSetId: string,
): CreateLaborRuleDefinitionDTO {
  return {
    tenant_id: tenantId,
    rule_set_id: ruleSetId,
    category: template.category,
    name: template.name,
    description: template.description,
    calc_type: template.calc_type,
    base_percentage: template.base_percentage,
    fixed_value: template.fixed_value,
    clt_article: template.clt_article,
    legal_basis: template.legal_basis,
    esocial_rubric_code: template.esocial_rubric_code,
    integra_inss: template.integra_inss,
    integra_irrf: template.integra_irrf,
    integra_fgts: template.integra_fgts,
    integra_ferias: template.integra_ferias,
    integra_13: template.integra_13,
    integra_dsr: template.integra_dsr,
    aplica_reflexos: template.aplica_reflexos,
    is_mandatory: template.is_mandatory,
    priority: template.priority,
  };
}

/**
 * Seed all standard rubrics into a rule set.
 * Typically called during tenant onboarding or rule set creation.
 */
export function buildStandardRuleDTOs(
  tenantId: string,
  ruleSetId: string,
): CreateLaborRuleDefinitionDTO[] {
  return STANDARD_RUBRIC_LIBRARY.map(t => templateToDTO(t, tenantId, ruleSetId));
}

/** Get count of templates by category */
export function getLibrarySummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  STANDARD_RUBRIC_LIBRARY.forEach(t => {
    summary[t.category] = (summary[t.category] ?? 0) + 1;
  });
  return summary;
}
