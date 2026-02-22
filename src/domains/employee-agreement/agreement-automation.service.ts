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
 * This service is the orchestration layer between HR Core
 * events and the AgreementAssignmentService.
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
  | 'employee.risk_exposure_added';

export interface AutomationResult {
  trigger: AutomationTrigger;
  employee_id: string;
  templates_matched: number;
  dispatched: number;
  errors: string[];
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

    const matched = templates.filter(t => {
      if (!t.obrigatorio) return false;
      // General terms apply to everyone
      if (t.tipo === 'geral') return true;
      // Position-specific terms
      if (t.tipo === 'funcao' && t.cargo_id && cargoId) return t.cargo_id === cargoId;
      return false;
    });

    const result: AutomationResult = {
      trigger: 'employee.hired',
      employee_id: employeeId,
      templates_matched: matched.length,
      dispatched: 0,
      errors: [],
    };

    for (const template of matched) {
      try {
        await agreementAssignmentService.sendForSignature({
          employee_id: employeeId,
          template_id: template.id,
          company_id: companyId,
        }, ctx);
        result.dispatched++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Template ${template.id}: ${message}`);
      }
    }

    emitAutomationEvent('employee.hired', result, ctx);
    return result;
  },

  /**
   * Trigger: JobPositionChanged
   *
   * Checks if the new position requires specific mandatory terms
   * that the employee hasn't signed yet.
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

    // Position-specific mandatory templates for the new role
    const positionTemplates = templates.filter(t =>
      t.obrigatorio && t.tipo === 'funcao' && t.cargo_id === newCargoId,
    );

    // Check which ones the employee already has (signed or pending)
    const { data: existing } = await supabase
      .from('employee_agreements')
      .select('template_id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', ctx.tenant_id)
      .in('status', ['pending', 'sent', 'signed']);

    const existingTemplateIds = new Set((existing || []).map((e: { template_id: string }) => e.template_id));

    const missing = positionTemplates.filter(t => !existingTemplateIds.has(t.id));

    const result: AutomationResult = {
      trigger: 'employee.position_changed',
      employee_id: employeeId,
      templates_matched: missing.length,
      dispatched: 0,
      errors: [],
    };

    for (const template of missing) {
      try {
        await agreementAssignmentService.sendForSignature({
          employee_id: employeeId,
          template_id: template.id,
          company_id: companyId,
        }, ctx);
        result.dispatched++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Template ${template.id}: ${message}`);
      }
    }

    emitAutomationEvent('employee.position_changed', result, ctx);
    return result;
  },

  /**
   * Trigger: RiskExposureAdded
   *
   * When a new risk exposure is added, sends mandatory
   * risk-related terms (tipo='risco') that haven't been signed.
   */
  async onRiskExposureAdded(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AutomationResult> {
    console.log(`[Automation] RiskExposureAdded → employee=${employeeId}`);

    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });

    // Risk-related mandatory templates
    const riskTemplates = templates.filter(t =>
      t.obrigatorio && t.tipo === 'risco',
    );

    // Check which ones the employee already has
    const { data: existing } = await supabase
      .from('employee_agreements')
      .select('template_id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', ctx.tenant_id)
      .in('status', ['pending', 'sent', 'signed']);

    const existingTemplateIds = new Set((existing || []).map((e: { template_id: string }) => e.template_id));

    const missing = riskTemplates.filter(t => !existingTemplateIds.has(t.id));

    const result: AutomationResult = {
      trigger: 'employee.risk_exposure_added',
      employee_id: employeeId,
      templates_matched: missing.length,
      dispatched: 0,
      errors: [],
    };

    for (const template of missing) {
      try {
        await agreementAssignmentService.sendForSignature({
          employee_id: employeeId,
          template_id: template.id,
          company_id: companyId,
        }, ctx);
        result.dispatched++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Template ${template.id}: ${message}`);
      }
    }

    emitAutomationEvent('employee.risk_exposure_added', result, ctx);
    return result;
  },
};

// ── Internal helper ──

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
