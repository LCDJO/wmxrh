/**
 * Agreement Assignment Rule Service
 *
 * Manages configurable rules that determine which agreement templates
 * are automatically dispatched based on events and employee context.
 *
 * Rule types:
 *   global              → applies to all employees on the trigger event
 *   por_cargo            → matches employee's cargo_id
 *   por_cbo              → matches employee's CBO code
 *   por_risco            → matches risk agent exposure
 *   por_evento           → matches specific event only (no extra filter)
 *
 * Trigger events:
 *   hiring | cargo_change | risco_update | fleet_assignment |
 *   epi_delivery | nr_training | department_transfer | reactivation
 */

import { supabase } from '@/integrations/supabase/client';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import { emitAgreementEvent } from './events';

// ── Types ──

export type AssignmentRuleType = 'global' | 'por_cargo' | 'por_cbo' | 'por_risco' | 'por_evento';

export type AssignmentTriggerEvent =
  | 'hiring'
  | 'cargo_change'
  | 'risco_update'
  | 'fleet_assignment'
  | 'epi_delivery'
  | 'nr_training'
  | 'department_transfer'
  | 'reactivation';

export interface AssignmentRule {
  id: string;
  tenant_id: string;
  template_id: string;
  regra_tipo: AssignmentRuleType;
  cargo_id: string | null;
  cbo_codigo: string | null;
  agente_risco: string | null;
  departamento_id: string | null;
  evento_disparo: AssignmentTriggerEvent;
  is_active: boolean;
  prioridade: number;
}

export interface CreateAssignmentRuleDTO {
  template_id: string;
  regra_tipo: AssignmentRuleType;
  cargo_id?: string | null;
  cbo_codigo?: string | null;
  agente_risco?: string | null;
  departamento_id?: string | null;
  evento_disparo: AssignmentTriggerEvent;
  prioridade?: number;
}

export interface MatchContext {
  evento: AssignmentTriggerEvent;
  cargo_id?: string | null;
  cbo_codigo?: string | null;
  agente_risco?: string | null;
  departamento_id?: string | null;
}

// ── Security ──

function buildPipeline(ctx: SecurityContext, action: PipelineInput['action']): PipelineInput {
  return {
    action,
    resource: 'agreement_templates',
    ctx,
    guardTarget: { tenantId: ctx.tenant_id },
  };
}

function toDomain(row: any): AssignmentRule {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    template_id: row.template_id,
    regra_tipo: row.regra_tipo,
    cargo_id: row.cargo_id,
    cbo_codigo: row.cbo_codigo,
    agente_risco: row.agente_risco,
    departamento_id: row.departamento_id,
    evento_disparo: row.evento_disparo,
    is_active: row.is_active,
    prioridade: row.prioridade,
  };
}

// ── Service ──

export const assignmentRuleService = {

  // ── CRUD ──

  async create(dto: CreateAssignmentRuleDTO, ctx: SecurityContext): Promise<AssignmentRule> {
    requirePermission(buildPipeline(ctx, 'create'));

    const row = scopedInsertFromContext({
      template_id: dto.template_id,
      regra_tipo: dto.regra_tipo,
      cargo_id: dto.cargo_id ?? null,
      cbo_codigo: dto.cbo_codigo ?? null,
      agente_risco: dto.agente_risco ?? null,
      departamento_id: dto.departamento_id ?? null,
      evento_disparo: dto.evento_disparo,
      is_active: true,
      prioridade: dto.prioridade ?? 0,
    }, ctx);

    const { data, error } = await supabase
      .from('agreement_assignment_rules')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;
    return toDomain(data);
  },

  async list(tenantId: string, opts?: { evento?: string; active_only?: boolean }): Promise<AssignmentRule[]> {
    let q = supabase
      .from('agreement_assignment_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('prioridade', { ascending: false });

    if (opts?.evento) q = q.eq('evento_disparo', opts.evento);
    if (opts?.active_only !== false) q = q.eq('is_active', true);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(toDomain);
  },

  async update(id: string, updates: Partial<CreateAssignmentRuleDTO & { is_active: boolean }>, ctx: SecurityContext): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const { error } = await supabase
      .from('agreement_assignment_rules')
      .update(updates as any)
      .eq('id', id)
      .eq('tenant_id', ctx.tenant_id);

    if (error) throw error;
  },

  async remove(id: string, ctx: SecurityContext): Promise<void> {
    requirePermission(buildPipeline(ctx, 'delete'));

    const { error } = await supabase
      .from('agreement_assignment_rules')
      .delete()
      .eq('id', id)
      .eq('tenant_id', ctx.tenant_id);

    if (error) throw error;
  },

  // ── MATCHING ENGINE ──

  /**
   * Find all template IDs that match the given context.
   * Rules are evaluated by priority (descending).
   */
  async matchTemplates(tenantId: string, matchCtx: MatchContext): Promise<string[]> {
    const rules = await this.list(tenantId, { evento: matchCtx.evento, active_only: true });

    const matched: string[] = [];

    for (const rule of rules) {
      if (this.evaluateRule(rule, matchCtx)) {
        matched.push(rule.template_id);
      }
    }

    // Deduplicate
    return [...new Set(matched)];
  },

  /**
   * Evaluate a single rule against a match context.
   */
  evaluateRule(rule: AssignmentRule, ctx: MatchContext): boolean {
    // Event must match
    if (rule.evento_disparo !== ctx.evento) return false;

    switch (rule.regra_tipo) {
      case 'global':
        return true;

      case 'por_cargo':
        return !!rule.cargo_id && !!ctx.cargo_id && rule.cargo_id === ctx.cargo_id;

      case 'por_cbo':
        return !!rule.cbo_codigo && !!ctx.cbo_codigo && rule.cbo_codigo === ctx.cbo_codigo;

      case 'por_risco':
        return !!rule.agente_risco && !!ctx.agente_risco && rule.agente_risco === ctx.agente_risco;

      case 'por_evento':
        // Matches on event alone — no additional filter
        return true;

      default:
        return false;
    }
  },
};
