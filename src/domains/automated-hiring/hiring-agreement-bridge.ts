/**
 * Hiring → Agreement Bridge
 *
 * Connects the Automated Hiring Workflow Engine to the Employee Agreement Engine.
 * When the workflow reaches the 'agreements' step, this bridge:
 *   1. Resolves required agreement templates (mandatory + conditional)
 *   2. Creates EmployeeAgreement records with status 'pending'
 *   3. Sends them for digital signature via the assignment service
 *   4. Provides a compliance check that blocks activation until all are signed
 *
 * This runs asynchronously — the workflow UI polls agreement status
 * and the signature provider callback updates records via webhook.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { agreementAssignmentService } from '@/domains/employee-agreement/agreement-assignment.service';
import { assignmentRuleService } from '@/domains/employee-agreement/assignment-rule.service';
import { agreementGovernanceOrchestrator } from '@/domains/employee-agreement/agreement-governance.orchestrator';
import type { AgreementEtapaInput, AgreementSignatureStatus, AgreementCategory } from './agreements-admission.engine';
import { resolveRequiredAgreements, validateAgreements } from './agreements-admission.engine';

// ── Types ──

export interface HiringAgreementDispatchResult {
  employee_id: string;
  templates_dispatched: number;
  templates_already_existing: number;
  templates_sent_for_signature: number;
  errors: string[];
}

export interface HiringAgreementComplianceCheck {
  employee_id: string;
  all_signed: boolean;
  total_required: number;
  signed_count: number;
  pending_count: number;
  pending_names: string[];
  can_advance: boolean;
}

// ── Category → DB category mapping ──
const CATEGORY_TO_DB: Record<AgreementCategory, string> = {
  contrato_trabalho: 'contrato',
  termo_lgpd: 'lgpd',
  termo_imagem: 'uso_imagem',
  termo_veiculo: 'veiculo',
  termo_gps: 'gps',
  termo_confidencialidade: 'confidencialidade',
  termo_ferramentas: 'outros',
  termo_epi: 'epi',
  termo_uniforme: 'outros',
};

// ── Service ──

export const hiringAgreementBridge = {

  /**
   * Step 1: Generate and dispatch all required agreements for a new hire.
   * Called when the hiring workflow enters the 'agreements' step.
   */
  async dispatchMandatoryAgreements(
    employeeId: string,
    companyId: string,
    positionInput: AgreementEtapaInput,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<HiringAgreementDispatchResult> {
    const result: HiringAgreementDispatchResult = {
      employee_id: employeeId,
      templates_dispatched: 0,
      templates_already_existing: 0,
      templates_sent_for_signature: 0,
      errors: [],
    };

    // 1. Resolve which agreement categories are required
    const requiredAgreements = resolveRequiredAgreements(positionInput);
    const requiredCategories = requiredAgreements.map(a => CATEGORY_TO_DB[a.category]);

    // 2. Find matching templates in DB
    const { data: templates } = await supabase
      .from('agreement_templates')
      .select('id, name, category, is_mandatory')
      .eq('tenant_id', ctx.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('category', requiredCategories);

    if (!templates || templates.length === 0) {
      result.errors.push('Nenhum template de termo encontrado para as categorias obrigatórias.');
      return result;
    }

    // 3. Check which agreements already exist for this employee
    const { data: existing } = await supabase
      .from('employee_agreements')
      .select('template_id, status')
      .eq('employee_id', employeeId)
      .eq('tenant_id', ctx.tenant_id)
      .in('status', ['pending', 'sent', 'signed']);

    const existingTemplateIds = new Set((existing || []).map((e: any) => e.template_id));

    // 4. Dispatch missing agreements
    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) {
        result.templates_already_existing++;
        continue;
      }

      try {
        await agreementAssignmentService.sendForSignature({
          employee_id: employeeId,
          template_id: template.id,
          company_id: companyId,
        }, ctx);
        result.templates_dispatched++;
        result.templates_sent_for_signature++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Template "${template.name}": ${msg}`);
        result.templates_dispatched++;
      }
    }

    // 5. Also check DB-configured assignment rules for 'hiring' event
    try {
      const ruleTemplateIds = await assignmentRuleService.matchTemplates(ctx.tenant_id, {
        evento: 'hiring',
      });

      for (const tid of ruleTemplateIds) {
        if (existingTemplateIds.has(tid)) continue;
        // Check if we already dispatched it above
        const alreadyDispatched = templates.some(t => t.id === tid);
        if (alreadyDispatched) continue;

        try {
          await agreementAssignmentService.sendForSignature({
            employee_id: employeeId,
            template_id: tid,
            company_id: companyId,
          }, ctx);
          result.templates_dispatched++;
          result.templates_sent_for_signature++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Rule-matched template ${tid}: ${msg}`);
        }
      }
    } catch {
      // Non-blocking — rules are supplementary
    }

    return result;
  },

  /**
   * Step 2: Check if all mandatory agreements are signed.
   * Called by the hiring workflow to determine if the 'agreements' step can advance.
   * This BLOCKS activation until all mandatory terms have status = 'signed'.
   */
  async checkComplianceForHiring(
    employeeId: string,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<HiringAgreementComplianceCheck> {
    // Use the governance orchestrator's compliance gate
    const gateResult = await agreementGovernanceOrchestrator.checkComplianceGate(
      employeeId,
      null, // cargo_id resolved internally
      companyId,
      ctx,
      scope,
    );

    return {
      employee_id: employeeId,
      all_signed: gateResult.all_mandatory_signed,
      total_required: gateResult.total_mandatory,
      signed_count: gateResult.signed,
      pending_count: gateResult.pending,
      pending_names: gateResult.missing_templates.map(t => t.nome_termo),
      can_advance: gateResult.all_mandatory_signed,
    };
  },

  /**
   * Build AgreementEtapaInput signatures from DB state.
   * Used by the workflow UI to build the input for validateAgreements().
   */
  async buildSignatureStatus(
    employeeId: string,
    tenantId: string,
  ): Promise<AgreementSignatureStatus[]> {
    const { data: agreements } = await supabase
      .from('employee_agreements')
      .select(`
        id, status, signed_at, signed_document_hash,
        template:agreement_templates!employee_agreements_template_id_fkey(id, category)
      `)
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'sent', 'signed']);

    if (!agreements) return [];

    // Reverse map DB category → AgreementCategory
    const DB_TO_CATEGORY: Record<string, AgreementCategory> = {
      contrato: 'contrato_trabalho',
      lgpd: 'termo_lgpd',
      uso_imagem: 'termo_imagem',
      veiculo: 'termo_veiculo',
      gps: 'termo_gps',
      confidencialidade: 'termo_confidencialidade',
      epi: 'termo_epi',
      outros: 'termo_ferramentas',
    };

    return agreements.map((agr: any) => {
      const template = Array.isArray(agr.template) ? agr.template[0] : agr.template;
      const dbCategory = template?.category ?? 'outros';
      const category = DB_TO_CATEGORY[dbCategory] ?? 'termo_ferramentas';

      return {
        category,
        agreement_template_id: template?.id ?? null,
        generated: true,
        generated_at: agr.created_at ?? null,
        signed: agr.status === 'signed',
        signed_at: agr.signed_at ?? null,
        signature_method: agr.status === 'signed' ? 'digital' : null,
        signature_hash: agr.signed_document_hash ?? null,
        witness_required: false,
        witness_signed: false,
      } as AgreementSignatureStatus;
    });
  },
};
