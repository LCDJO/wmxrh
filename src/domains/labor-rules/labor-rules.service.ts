/**
 * Labor Rules Engine Service
 * Manages CLT rules, salary calculations parameters, and collective agreements.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type {
  LaborRuleSet, LaborRuleSetWithRules, LaborRuleDefinition,
  CollectiveAgreement, CollectiveAgreementWithClauses, CollectiveAgreementClause,
  CreateLaborRuleSetDTO, CreateLaborRuleDefinitionDTO,
  CreateCollectiveAgreementDTO, CreateCollectiveAgreementClauseDTO,
} from './types';

export const laborRulesService = {
  // ── Rule Sets ──

  async listRuleSets(scope: QueryScope): Promise<LaborRuleSetWithRules[]> {
    const q = applyScope(
      supabase.from('labor_rule_sets' as any).select('*, labor_rule_definitions(*)'),
      scope,
      { skipScopeFilter: true }
    ).order('name');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as LaborRuleSetWithRules[];
  },

  async getRuleSet(id: string, scope: QueryScope): Promise<LaborRuleSetWithRules> {
    const { data, error } = await supabase
      .from('labor_rule_sets' as any)
      .select('*, labor_rule_definitions(*)')
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .single();
    if (error) throw error;
    return data as unknown as LaborRuleSetWithRules;
  },

  async createRuleSet(dto: CreateLaborRuleSetDTO, scope: QueryScope): Promise<LaborRuleSet> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase
      .from('labor_rule_sets' as any)
      .insert(secured)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LaborRuleSet;
  },

  // ── Rule Definitions ──

  async listRuleDefinitions(ruleSetId: string, scope: QueryScope): Promise<LaborRuleDefinition[]> {
    const { data, error } = await supabase
      .from('labor_rule_definitions' as any)
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .eq('rule_set_id', ruleSetId)
      .is('deleted_at', null)
      .order('priority')
      .order('category');
    if (error) throw error;
    return (data || []) as unknown as LaborRuleDefinition[];
  },

  async createRuleDefinition(dto: CreateLaborRuleDefinitionDTO, scope: QueryScope): Promise<LaborRuleDefinition> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase
      .from('labor_rule_definitions' as any)
      .insert(secured)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LaborRuleDefinition;
  },

  async updateRuleDefinition(id: string, updates: Partial<LaborRuleDefinition>): Promise<LaborRuleDefinition> {
    const { tenant_id, id: _id, created_at, ...safe } = updates as any;
    const { data, error } = await supabase
      .from('labor_rule_definitions' as any)
      .update(safe)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LaborRuleDefinition;
  },

  // ── Collective Agreements ──

  async listAgreements(scope: QueryScope): Promise<CollectiveAgreementWithClauses[]> {
    const q = applyScope(
      supabase.from('collective_agreements' as any).select('*, collective_agreement_clauses(*), labor_rule_sets(name)'),
      scope,
      { skipScopeFilter: true }
    ).order('valid_from', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as CollectiveAgreementWithClauses[];
  },

  async createAgreement(dto: CreateCollectiveAgreementDTO, scope: QueryScope): Promise<CollectiveAgreement> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase
      .from('collective_agreements' as any)
      .insert(secured)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CollectiveAgreement;
  },

  // ── Agreement Clauses ──

  async createClause(dto: CreateCollectiveAgreementClauseDTO, scope: QueryScope): Promise<CollectiveAgreementClause> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase
      .from('collective_agreement_clauses' as any)
      .insert(secured)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CollectiveAgreementClause;
  },

  // ── Utility: Get active rules for an employee's company ──

  async getEffectiveRules(companyId: string, scope: QueryScope): Promise<LaborRuleDefinition[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('labor_rule_definitions' as any)
      .select('*, labor_rule_sets!inner(tenant_id, company_id, is_active)')
      .eq('labor_rule_sets.tenant_id', scope.tenantId)
      .eq('labor_rule_sets.is_active', true)
      .is('deleted_at', null)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order('priority');
    if (error) throw error;
    // Filter by company match or null (tenant-wide rules)
    return ((data || []) as unknown as (LaborRuleDefinition & { labor_rule_sets: { company_id: string | null } })[])
      .filter(r => !r.labor_rule_sets.company_id || r.labor_rule_sets.company_id === companyId);
  },
};

// ── Category & CalcType Labels ──

export const RULE_CATEGORY_LABELS: Record<string, string> = {
  hora_extra: 'Hora Extra',
  adicional_noturno: 'Adicional Noturno',
  insalubridade: 'Insalubridade',
  periculosidade: 'Periculosidade',
  sobreaviso: 'Sobreaviso',
  plantao: 'Plantão',
  intervalo_intrajornada: 'Intervalo Intrajornada',
  dsr: 'DSR',
  ferias: 'Férias',
  decimo_terceiro: '13º Salário',
  aviso_previo: 'Aviso Prévio',
  fgts: 'FGTS',
  contribuicao_sindical: 'Contrib. Sindical',
  vale_transporte: 'Vale Transporte',
  salario_familia: 'Salário Família',
  licenca_maternidade: 'Licença Maternidade',
  licenca_paternidade: 'Licença Paternidade',
  piso_salarial: 'Piso Salarial',
  reajuste_anual: 'Reajuste Anual',
  banco_horas: 'Banco de Horas',
  custom: 'Personalizado',
};

export const CALC_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentual',
  fixed_value: 'Valor Fixo',
  tiered: 'Escalonado',
  formula: 'Fórmula',
  reference_table: 'Tabela Referência',
};
