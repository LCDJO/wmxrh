/**
 * Agreement Automation Service
 *
 * Hybrid orchestration layer: uses DB-configured assignment rules
 * (agreement_assignment_rules) when available, falling back to
 * template-level escopo/categoria matching.
 *
 * Triggers:
 *   EmployeeHired        → global + cargo-specific terms
 *   JobPositionChanged   → cargo-specific terms
 *   RiskExposureAdded    → risk-related terms
 *   EPIDelivered         → EPI terms
 *   FleetAssigned        → vehicle terms
 *   NRTrainingCompleted  → training terms
 *   DepartmentTransferred → department terms
 *
 * This is the SINGLE orchestration layer for auto-dispatch.
 */

import { supabase } from '@/integrations/supabase/client';
import { agreementAssignmentService } from './agreement-assignment.service';
import { agreementTemplateService } from './agreement-template.service';
import { assignmentRuleService, type MatchContext } from './assignment-rule.service';
import { emitAgreementEvent } from './events';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { QueryScope } from '@/domains/shared/scoped-query';

// ── Types ──

export type AutomationTrigger =
  | 'employee.hired'
  | 'employee.position_changed'
  | 'employee.risk_exposure_added'
  | 'employee.epi_delivered'
  | 'employee.fleet_assigned'
  | 'employee.nr_training_completed'
  | 'employee.department_transferred';

export interface AutomationResult {
  trigger: AutomationTrigger;
  employee_id: string;
  templates_matched: number;
  dispatched: number;
  skipped_existing: number;
  errors: string[];
}

// ── Internal Helpers ──

async function getExistingTemplateIds(employeeId: string, tenantId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('employee_agreements')
    .select('template_id, status')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'sent', 'signed']);

  return new Set((data || []).map((e: { template_id: string }) => e.template_id));
}

async function dispatchTemplateIds(
  templateIds: string[],
  employeeId: string,
  companyId: string,
  existingIds: Set<string>,
  ctx: SecurityContext,
): Promise<{ dispatched: number; skipped: number; errors: string[] }> {
  const missing = templateIds.filter(id => !existingIds.has(id));
  const skipped = templateIds.length - missing.length;
  let dispatched = 0;
  const errors: string[] = [];

  for (const templateId of missing) {
    try {
      await agreementAssignmentService.sendForSignature({
        employee_id: employeeId,
        template_id: templateId,
        company_id: companyId,
      }, ctx);
      dispatched++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Template ${templateId}: ${message}`);
    }
  }

  return { dispatched, skipped, errors };
}

function emitAutomationEvent(trigger: AutomationTrigger, result: AutomationResult, ctx: SecurityContext) {
  emitAgreementEvent({
    type: 'agreement.auto_dispatch_triggered',
    tenant_id: ctx.tenant_id,
    employee_id: result.employee_id,
    payload: {
      trigger,
      templates_matched: result.templates_matched,
      dispatched: result.dispatched,
      skipped_existing: result.skipped_existing,
      errors: result.errors,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Core resolver: tries DB rules first, then falls back to template escopo/categoria matching.
 */
async function resolveTemplateIds(
  tenantId: string,
  matchCtx: MatchContext,
  fallbackFilter: (t: any) => boolean,
  ctx: SecurityContext,
  scope: QueryScope,
): Promise<string[]> {
  // 1. Try DB-configured rules
  const ruleMatched = await assignmentRuleService.matchTemplates(tenantId, matchCtx);

  if (ruleMatched.length > 0) {
    console.log(`[Automation] DB rules matched ${ruleMatched.length} templates for ${matchCtx.evento}`);
    return ruleMatched;
  }

  // 2. Fallback: template-level matching
  const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
  const matched = templates.filter(fallbackFilter);
  console.log(`[Automation] Fallback matched ${matched.length} templates for ${matchCtx.evento}`);
  return matched.map(t => t.id);
}

// ── Service ──

export const agreementAutomationService = {

  /**
   * Generic trigger handler that uses resolveTemplateIds.
   */
  async executeTrigger(
    trigger: AutomationTrigger,
    employeeId: string,
    companyId: string,
    matchCtx: MatchContext,
    fallbackFilter: (t: any) => boolean,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    console.log(`[Automation] ${trigger} → employee=${employeeId}`);

    const [templateIds, existingIds] = await Promise.all([
      resolveTemplateIds(ctx.tenant_id, matchCtx, fallbackFilter, ctx, scope),
      getExistingTemplateIds(employeeId, ctx.tenant_id),
    ]);

    const { dispatched, skipped, errors } = await dispatchTemplateIds(
      templateIds, employeeId, companyId, existingIds, ctx,
    );

    const result: AutomationResult = {
      trigger,
      employee_id: employeeId,
      templates_matched: templateIds.length,
      dispatched,
      skipped_existing: skipped,
      errors,
    };

    emitAutomationEvent(trigger, result, ctx);
    return result;
  },

  // ── Named Triggers ──

  async onEmployeeHired(
    employeeId: string,
    companyId: string,
    cargoId: string | null,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.hired',
      employeeId,
      companyId,
      { evento: 'hiring', cargo_id: cargoId },
      (t) => {
        if (!t.obrigatorio) return false;
        if (t.escopo === 'global') return true;
        if (t.escopo === 'cargo' && t.cargo_id && cargoId) return t.cargo_id === cargoId;
        return false;
      },
      ctx,
      scope,
    );
  },

  async onJobPositionChanged(
    employeeId: string,
    newCargoId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.position_changed',
      employeeId,
      companyId,
      { evento: 'cargo_change', cargo_id: newCargoId },
      (t) => t.obrigatorio && t.escopo === 'cargo' && t.cargo_id === newCargoId,
      ctx,
      scope,
    );
  },

  async onRiskExposureAdded(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
    agenteRisco?: string,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.risk_exposure_added',
      employeeId,
      companyId,
      { evento: 'risco_update', agente_risco: agenteRisco },
      (t) => t.obrigatorio && t.escopo === 'risco',
      ctx,
      scope,
    );
  },

  async onEPIDelivered(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.epi_delivered',
      employeeId,
      companyId,
      { evento: 'epi_delivery' },
      (t) => t.obrigatorio && t.categoria === 'epi',
      ctx,
      scope,
    );
  },

  async onFleetAssigned(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.fleet_assigned',
      employeeId,
      companyId,
      { evento: 'fleet_assignment' },
      (t) => t.obrigatorio && (t.categoria === 'veiculo' || t.categoria === 'gps'),
      ctx,
      scope,
    );
  },

  async onNRTrainingCompleted(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.nr_training_completed',
      employeeId,
      companyId,
      { evento: 'nr_training' },
      (t) => t.obrigatorio && t.escopo === 'risco',
      ctx,
      scope,
    );
  },

  async onDepartmentTransferred(
    employeeId: string,
    companyId: string,
    cargoId: string | null,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    return this.executeTrigger(
      'employee.department_transferred',
      employeeId,
      companyId,
      { evento: 'department_transfer', cargo_id: cargoId },
      (t) => {
        if (!t.obrigatorio) return false;
        if (t.escopo === 'cargo' && t.cargo_id && cargoId) return t.cargo_id === cargoId;
        return false;
      },
      ctx,
      scope,
    );
  },
};
