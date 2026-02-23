/**
 * Agreement Automation Service
 *
 * Listens to HR domain events and automatically triggers
 * agreement assignment workflows:
 *
 *   EmployeeHired        → send mandatory general terms
 *   JobPositionChanged   → check position-specific terms
 *   RiskExposureAdded    → add risk-related terms
 *
 * This is the SINGLE orchestration layer for auto-dispatch.
 * (Removed duplicate logic that was in agreement-assignment.service)
 */

import { supabase } from '@/integrations/supabase/client';
import { agreementAssignmentService } from './agreement-assignment.service';
import { agreementTemplateService } from './agreement-template.service';
import { emitAgreementEvent } from './events';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { QueryScope } from '@/domains/shared/scoped-query';

// ── Automation Event Types ──

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
  errors: string[];
}

// ── Internal Helpers ──

/**
 * Get template IDs already assigned to the employee (pending/sent/signed).
 */
async function getExistingTemplateIds(employeeId: string, tenantId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('employee_agreements')
    .select('template_id, status')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'sent', 'signed']);

  return new Set((data || []).map((e: { template_id: string }) => e.template_id));
}

/**
 * Dispatch a list of templates to an employee, skipping already assigned.
 */
async function dispatchTemplates(
  templates: { id: string }[],
  employeeId: string,
  companyId: string,
  existingIds: Set<string>,
  ctx: SecurityContext,
): Promise<{ dispatched: number; errors: string[] }> {
  const missing = templates.filter(t => !existingIds.has(t.id));
  let dispatched = 0;
  const errors: string[] = [];

  for (const template of missing) {
    try {
      await agreementAssignmentService.sendForSignature({
        employee_id: employeeId,
        template_id: template.id,
        company_id: companyId,
      }, ctx);
      dispatched++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Template ${template.id}: ${message}`);
    }
  }

  return { dispatched, errors };
}

function emitAutomationEvent(
  trigger: AutomationTrigger,
  result: AutomationResult,
  ctx: SecurityContext,
) {
  emitAgreementEvent({
    type: 'agreement.auto_dispatch_triggered',
    tenant_id: ctx.tenant_id,
    employee_id: result.employee_id,
    payload: {
      trigger,
      templates_matched: result.templates_matched,
      dispatched: result.dispatched,
      errors: result.errors,
    },
    timestamp: new Date().toISOString(),
  });
}

// ── Service ──

export const agreementAutomationService = {

  /**
   * Trigger: EmployeeHired
   *
   * Sends all mandatory general terms (tipo='geral') and
   * position-specific terms if cargo_id matches.
   */
  async onEmployeeHired(
    employeeId: string,
    companyId: string,
    cargoId: string | null,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    console.log(`[Automation] EmployeeHired → employee=${employeeId}`);

    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
    const existingIds = await getExistingTemplateIds(employeeId, ctx.tenant_id);

    const matched = templates.filter(t => {
      if (!t.obrigatorio) return false;
      if (t.tipo === 'geral') return true;
      if (t.tipo === 'funcao' && t.cargo_id && cargoId) return t.cargo_id === cargoId;
      return false;
    });

    const { dispatched, errors } = await dispatchTemplates(matched, employeeId, companyId, existingIds, ctx);

    const result: AutomationResult = {
      trigger: 'employee.hired',
      employee_id: employeeId,
      templates_matched: matched.length,
      dispatched,
      errors,
    };

    emitAutomationEvent('employee.hired', result, ctx);
    return result;
  },

  /**
   * Trigger: JobPositionChanged
   */
  async onJobPositionChanged(
    employeeId: string,
    newCargoId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    console.log(`[Automation] JobPositionChanged → employee=${employeeId}, cargo=${newCargoId}`);

    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
    const existingIds = await getExistingTemplateIds(employeeId, ctx.tenant_id);

    const positionTemplates = templates.filter(t =>
      t.obrigatorio && t.tipo === 'funcao' && t.cargo_id === newCargoId,
    );

    const { dispatched, errors } = await dispatchTemplates(positionTemplates, employeeId, companyId, existingIds, ctx);

    const result: AutomationResult = {
      trigger: 'employee.position_changed',
      employee_id: employeeId,
      templates_matched: positionTemplates.length,
      dispatched,
      errors,
    };

    emitAutomationEvent('employee.position_changed', result, ctx);
    return result;
  },

  /**
   * Trigger: RiskExposureAdded
   */
  async onRiskExposureAdded(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    console.log(`[Automation] RiskExposureAdded → employee=${employeeId}`);

    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
    const existingIds = await getExistingTemplateIds(employeeId, ctx.tenant_id);

    const riskTemplates = templates.filter(t =>
      t.obrigatorio && t.tipo === 'risco',
    );

    const { dispatched, errors } = await dispatchTemplates(riskTemplates, employeeId, companyId, existingIds, ctx);

    const result: AutomationResult = {
      trigger: 'employee.risk_exposure_added',
      employee_id: employeeId,
      templates_matched: riskTemplates.length,
      dispatched,
      errors,
    };

    emitAutomationEvent('employee.risk_exposure_added', result, ctx);
    return result;
  },
};
