/**
 * Legal Agreements Governance Orchestrator
 *
 * Central orchestration layer that receives triggers from all integrated engines
 * and dispatches the correct agreement templates to employees.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │              Governance Orchestrator                     │
 * ├─────────────────────────────────────────────────────────┤
 * │  handleTrigger()         — unified entry point          │
 * │  checkComplianceGate()   — hiring workflow gate         │
 * │  getEmployeeCompliance() — full compliance snapshot     │
 * │  matchTemplates()        — rule-based template matching │
 * └─────────────────────────────────────────────────────────┘
 *
 * Integrated Engines:
 *   - Automated Hiring Workflow → compliance gate
 *   - Career & Legal Intelligence → position/promotion terms
 *   - EPI Lifecycle → EPI delivery terms
 *   - Fleet Compliance → vehicle authorization terms
 *   - NR Training Lifecycle → training acknowledgment terms
 *   - Employee Master Record → profile change terms
 */

import { supabase } from '@/integrations/supabase/client';
import { agreementTemplateService } from './agreement-template.service';
import { agreementAssignmentService } from './agreement-assignment.service';
import { emitAgreementEvent } from './events';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { AgreementTemplate } from './types';
import {
  TRIGGER_MATCH_RULES,
  type GovernanceTrigger,
  type GovernanceDispatchResult,
  type ComplianceGateResult,
  type TemplateMatchRule,
  type GovernanceTriggerSource,
} from './integration-contracts';

// ── Security ──

function buildPipeline(ctx: SecurityContext, action: PipelineInput['action']): PipelineInput {
  return {
    action,
    resource: 'employee_agreements',
    ctx,
    guardTarget: { tenantId: ctx.tenant_id },
  };
}

// ── Template Matching ──

function matchesRule(template: AgreementTemplate, rule: TemplateMatchRule, cargoId?: string | null): boolean {
  // Type check (supports both old tipo and new categoria)
  if (!rule.tipos.includes(template.tipo) && !rule.tipos.includes(template.categoria)) return false;

  // Mandatory check
  if (rule.mandatory_only && !template.obrigatorio) return false;

  // Cargo-specific check
  if (rule.cargo_id && template.cargo_id && template.cargo_id !== rule.cargo_id) return false;

  // Escopo-based matching
  if (!rule.include_global && template.escopo === 'global') return false;
  if (template.escopo === 'cargo' || template.escopo === 'funcao_especifica') {
    if (!template.cargo_id) return false;
    if (cargoId && template.cargo_id !== cargoId) return false;
  }

  // CBO matching (if template has cbo_codigo, check against trigger context)
  // Note: CBO matching is handled by the template's own cbo_codigo field

  // Category keyword matching (for EPI, Fleet, NR terms)
  if (rule.category_keywords?.length) {
    const templateName = (template.nome_termo || '').toLowerCase();
    const templateDesc = (template.descricao || '').toLowerCase();
    const combined = `${templateName} ${templateDesc}`;
    const hasKeyword = rule.category_keywords.some(kw => combined.includes(kw.toLowerCase()));
    if (!hasKeyword) return false;
  }

  return true;
}

// ── Helpers ──

async function getExistingTemplateIds(employeeId: string, tenantId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('employee_agreements')
    .select('template_id, status')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'sent', 'signed']);

  return new Set((data || []).map((e: any) => e.template_id));
}

function resolveCargoId(trigger: GovernanceTrigger): string | null {
  if ('cargo_id' in trigger) return trigger.cargo_id ?? null;
  if ('new_cargo_id' in trigger) return trigger.new_cargo_id ?? null;
  return null;
}

function resolveTriggerKey(trigger: GovernanceTrigger): string {
  return `${trigger.source}:${trigger.event}`;
}

// ── Orchestrator ──

export const agreementGovernanceOrchestrator = {

  /**
   * Unified entry point for all cross-engine triggers.
   * Matches templates based on trigger rules and dispatches to the employee.
   */
  async handleTrigger(
    trigger: GovernanceTrigger,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<GovernanceDispatchResult> {
    requirePermission(buildPipeline(ctx, 'create'));

    const triggerKey = resolveTriggerKey(trigger);
    const cargoId = resolveCargoId(trigger);

    console.log(`[Governance] Trigger: ${triggerKey} → employee=${trigger.employee_id}`);

    // 1. Get matching rule
    const rule = TRIGGER_MATCH_RULES[triggerKey];
    if (!rule) {
      console.warn(`[Governance] No matching rule for trigger: ${triggerKey}`);
      return {
        trigger_source: trigger.source,
        trigger_event: trigger.event,
        employee_id: trigger.employee_id,
        templates_matched: 0,
        dispatched: 0,
        skipped_existing: 0,
        errors: [`No matching rule for trigger: ${triggerKey}`],
        compliance_status: 'pending',
      };
    }

    // 2. Load active templates and existing assignments
    const [templates, existingIds] = await Promise.all([
      agreementTemplateService.list(ctx, scope, { active_only: true }),
      getExistingTemplateIds(trigger.employee_id, ctx.tenant_id),
    ]);

    // 3. Apply cargo_id to rule if available
    const enrichedRule: TemplateMatchRule = { ...rule, cargo_id: cargoId };

    // 4. Match templates
    const matched = templates.filter(t => matchesRule(t, enrichedRule, cargoId));

    // 5. Filter already assigned
    const toDispatch = matched.filter(t => !existingIds.has(t.id));
    const skipped = matched.length - toDispatch.length;

    // 6. Dispatch
    let dispatched = 0;
    const errors: string[] = [];

    for (const template of toDispatch) {
      try {
        await agreementAssignmentService.sendForSignature({
          employee_id: trigger.employee_id,
          template_id: template.id,
          company_id: trigger.company_id,
        }, ctx);
        dispatched++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Template ${template.id} (${template.nome_termo}): ${message}`);
      }
    }

    // 7. Determine compliance status
    const mandatoryMissing = matched.filter(t => t.obrigatorio && !existingIds.has(t.id));
    const complianceStatus = errors.length > 0
      ? 'blocked'
      : mandatoryMissing.length > dispatched
        ? 'pending'
        : 'compliant';

    const result: GovernanceDispatchResult = {
      trigger_source: trigger.source,
      trigger_event: trigger.event,
      employee_id: trigger.employee_id,
      templates_matched: matched.length,
      dispatched,
      skipped_existing: skipped,
      errors,
      compliance_status: complianceStatus,
    };

    // 8. Emit governance event
    emitAgreementEvent({
      type: 'agreement.governance.dispatch_triggered',
      tenant_id: ctx.tenant_id,
      employee_id: trigger.employee_id,
      company_id: trigger.company_id,
      payload: {
        trigger_source: trigger.source,
        trigger_event: trigger.event,
        templates_matched: matched.length,
        dispatched,
        skipped: skipped,
        compliance_status: complianceStatus,
      },
      timestamp: new Date().toISOString(),
    });

    // 9. Emit integration-specific events
    const integrationEventMap: Record<string, string> = {
      epi_lifecycle: 'agreement.integration.epi_term_dispatched',
      fleet_compliance: 'agreement.integration.fleet_term_dispatched',
      nr_training: 'agreement.integration.nr_training_term_dispatched',
      career_engine: 'agreement.integration.career_term_dispatched',
    };

    if (integrationEventMap[trigger.source] && dispatched > 0) {
      emitAgreementEvent({
        type: integrationEventMap[trigger.source] as any,
        tenant_id: ctx.tenant_id,
        employee_id: trigger.employee_id,
        company_id: trigger.company_id,
        payload: { dispatched, trigger_event: trigger.event },
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  },

  /**
   * Compliance Gate — called by Automated Hiring Workflow Engine.
   *
   * Checks whether ALL mandatory terms for the employee's cargo/department
   * have been signed, returning a blocking result if not.
   */
  async checkComplianceGate(
    employeeId: string,
    cargoId: string | null,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<ComplianceGateResult> {
    requirePermission(buildPipeline(ctx, 'view'));

    // 1. Get all mandatory templates applicable to this employee
    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
    const mandatory = templates.filter(t => {
      if (!t.obrigatorio) return false;
      if (t.tipo === 'geral') return true;
      if (t.tipo === 'funcao' && t.cargo_id && cargoId) return t.cargo_id === cargoId;
      if (t.tipo === 'lgpd') return true;
      return false;
    });

    // 2. Get employee's agreements
    const { data: agreements } = await supabase
      .from('employee_agreements')
      .select('template_id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', ctx.tenant_id);

    const agrMap = new Map<string, string>();
    for (const a of (agreements || []) as any[]) {
      const existing = agrMap.get(a.template_id);
      // Keep best status: signed > sent > pending > others
      const priority: Record<string, number> = { signed: 4, sent: 3, pending: 2 };
      if (!existing || (priority[a.status] || 0) > (priority[existing] || 0)) {
        agrMap.set(a.template_id, a.status);
      }
    }

    // 3. Build compliance snapshot
    const missingTemplates: ComplianceGateResult['missing_templates'] = [];
    let signedCount = 0;
    let pendingCount = 0;

    for (const t of mandatory) {
      const status = agrMap.get(t.id);
      if (status === 'signed') {
        signedCount++;
      } else if (status) {
        pendingCount++;
        missingTemplates.push({
          template_id: t.id,
          nome_termo: t.nome_termo,
          tipo: t.tipo,
          status: status as any,
        });
      } else {
        pendingCount++;
        missingTemplates.push({
          template_id: t.id,
          nome_termo: t.nome_termo,
          tipo: t.tipo,
          status: 'not_assigned',
        });
      }
    }

    const allSigned = signedCount === mandatory.length;
    const blockingReasons: string[] = [];

    if (!allSigned) {
      for (const m of missingTemplates) {
        blockingReasons.push(`Termo "${m.nome_termo}" (${m.tipo}): ${m.status === 'not_assigned' ? 'não atribuído' : m.status}`);
      }
    }

    const result: ComplianceGateResult = {
      employee_id: employeeId,
      all_mandatory_signed: allSigned,
      total_mandatory: mandatory.length,
      signed: signedCount,
      pending: pendingCount,
      missing_templates: missingTemplates,
      can_activate: allSigned,
      blocking_reasons: blockingReasons,
    };

    // Emit compliance gate event
    const eventType = allSigned
      ? 'agreement.governance.all_mandatory_signed'
      : 'agreement.governance.compliance_blocked';

    emitAgreementEvent({
      type: eventType as any,
      tenant_id: ctx.tenant_id,
      employee_id: employeeId,
      company_id: companyId,
      payload: {
        total_mandatory: mandatory.length,
        signed: signedCount,
        pending: pendingCount,
        can_activate: allSigned,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  },

  /**
   * Get full compliance snapshot for an employee — used by Employee Master Record.
   */
  async getEmployeeCompliance(
    employeeId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<{
    total_assigned: number;
    signed: number;
    pending: number;
    expired: number;
    rejected: number;
    compliance_rate: number;
    mandatory_compliance_rate: number;
  }> {
    requirePermission(buildPipeline(ctx, 'view'));

    const agreements = await agreementAssignmentService.listByEmployee(employeeId, ctx, scope);

    const byStatus = { signed: 0, pending: 0, sent: 0, expired: 0, rejected: 0, renewed: 0 };
    for (const a of agreements) {
      byStatus[a.status as keyof typeof byStatus] = (byStatus[a.status as keyof typeof byStatus] || 0) + 1;
    }

    const total = agreements.length;
    const complianceRate = total > 0 ? (byStatus.signed / total) * 100 : 100;

    // For mandatory compliance, we'd need template info
    // Simplified: use overall rate
    return {
      total_assigned: total,
      signed: byStatus.signed,
      pending: byStatus.pending + byStatus.sent,
      expired: byStatus.expired,
      rejected: byStatus.rejected,
      compliance_rate: Math.round(complianceRate * 10) / 10,
      mandatory_compliance_rate: Math.round(complianceRate * 10) / 10,
    };
  },

  /**
   * Bulk dispatch for a specific trigger source — convenience for batch operations.
   */
  async bulkDispatchForEmployees(
    employeeIds: string[],
    trigger: Omit<GovernanceTrigger, 'employee_id'> & { employee_id?: string },
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<GovernanceDispatchResult[]> {
    const results: GovernanceDispatchResult[] = [];

    for (const empId of employeeIds) {
      const fullTrigger = { ...trigger, employee_id: empId } as GovernanceTrigger;
      const result = await this.handleTrigger(fullTrigger, ctx, scope);
      results.push(result);
    }

    return results;
  },
};
