/**
 * AgreementAssignmentService
 *
 * Assigns agreements to employees, sends for signature,
 * handles auto-dispatch on admission, and manages lifecycle.
 *
 * Delegates signature execution to DigitalSignatureProviderAdapter.
 * Delegates document storage to DocumentVault.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, type QueryScope } from '@/domains/shared/scoped-query';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import { emitAgreementEvent } from './events';
import { digitalSignatureAdapter } from './digital-signature-adapter';
import { documentVault } from './document-vault';
import { agreementTemplateService } from './agreement-template.service';
import type {
  EmployeeAgreement,
  SendForSignatureDTO,
  SignatureCallbackDTO,
  SignatureProvider,
  AgreementDashboardStats,
  AgreementStatus,
} from './types';

function buildPipeline(
  ctx: SecurityContext,
  action: PipelineInput['action'],
  companyId?: string | null,
): PipelineInput {
  return {
    action,
    resource: 'employee_agreements',
    ctx,
    target: companyId ? { company_id: companyId } : undefined,
    guardTarget: { tenantId: ctx.tenant_id, companyId: companyId ?? undefined },
  };
}

export const agreementAssignmentService = {

  // ── SEND FOR SIGNATURE ──

  async sendForSignature(
    dto: SendForSignatureDTO,
    ctx: SecurityContext,
  ): Promise<EmployeeAgreement> {
    requirePermission(buildPipeline(ctx, 'create', dto.company_id));

    // Resolve current version
    const version = await agreementTemplateService.getCurrentVersion(dto.template_id);
    if (!version) throw new Error('Template não possui versão publicada.');

    const template = await agreementTemplateService.getById(dto.template_id, ctx);
    if (!template) throw new Error('Template não encontrado.');

    // Get employee signer info
    const { data: employee } = await supabase
      .from('employees')
      .select('name, email, cpf')
      .eq('id', dto.employee_id)
      .single();
    if (!employee) throw new Error('Colaborador não encontrado.');

    const providerName: SignatureProvider = dto.provider ?? 'simulation';

    // Delegate to DigitalSignatureProviderAdapter
    const signResult = await digitalSignatureAdapter.send(providerName, {
      document_title: version.title,
      document_content_html: version.content_html,
      signer_name: employee.name,
      signer_email: employee.email ?? '',
      signer_cpf: employee.cpf ?? undefined,
      requires_witness: template.requires_witness,
    });

    const expiresAt = template.expiry_days
      ? new Date(Date.now() + template.expiry_days * 86400000).toISOString()
      : null;

    const row = scopedInsertFromContext({
      employee_id: dto.employee_id,
      template_id: dto.template_id,
      template_version_id: version.id,
      company_id: dto.company_id ?? template.company_id ?? null,
      company_group_id: template.company_group_id ?? null,
      status: signResult.status === 'sent' ? 'sent' : 'pending',
      signature_provider: providerName,
      external_document_id: signResult.external_document_id || null,
      external_signing_url: signResult.signing_url || null,
      sent_at: signResult.status === 'sent' ? new Date().toISOString() : null,
      expires_at: expiresAt,
      sent_by: ctx.user_id,
    }, ctx);

    const { data, error } = await supabase
      .from('employee_agreements')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.sent_for_signature',
      tenant_id: ctx.tenant_id,
      employee_id: dto.employee_id,
      agreement_id: data.id,
      template_id: dto.template_id,
      company_id: dto.company_id,
      payload: { provider: providerName, version: version.version_number },
      timestamp: new Date().toISOString(),
    });

    return data as unknown as EmployeeAgreement;
  },

  // ── SIGNATURE CALLBACK ──

  async processCallback(dto: SignatureCallbackDTO, ctx: SecurityContext): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const update: Record<string, unknown> = {
      status: dto.status,
      ip_address: dto.ip_address,
      user_agent: dto.user_agent,
    };

    if (dto.status === 'signed') {
      update.signed_at = new Date().toISOString();
      update.signed_document_hash = dto.signed_document_hash;

      // Delegate document storage to DocumentVault
      if (dto.external_document_id) {
        const { data: agr } = await supabase
          .from('employee_agreements')
          .select('tenant_id, signature_provider')
          .eq('id', dto.agreement_id)
          .single();

        if (agr) {
          const storagePath = await documentVault.storeSignedDocument(
            (agr as any).tenant_id,
            dto.agreement_id,
            dto.external_document_id,
            (agr as any).signature_provider,
          );
          if (storagePath) update.signed_document_url = storagePath;
        }
      }
    } else if (dto.status === 'refused') {
      update.refused_at = new Date().toISOString();
      update.refusal_reason = dto.refusal_reason;
    }

    const { error } = await supabase
      .from('employee_agreements')
      .update(update)
      .eq('id', dto.agreement_id);

    if (error) throw error;

    emitAgreementEvent({
      type: dto.status === 'signed' ? 'agreement.signed' : 'agreement.refused',
      tenant_id: ctx.tenant_id,
      agreement_id: dto.agreement_id,
      payload: { status: dto.status },
      timestamp: new Date().toISOString(),
    });
  },

  // ── LIST ──

  async listByEmployee(
    employeeId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<EmployeeAgreement[]> {
    requirePermission(buildPipeline(ctx, 'view'));

    const { data, error } = await applyScope(
      supabase.from('employee_agreements').select('*'),
      scope,
    )
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as EmployeeAgreement[];
  },

  // ── AUTO-DISPATCH ON ADMISSION ──

  async autoDispatchForNewEmployee(
    employeeId: string,
    positionId: string | null,
    departmentId: string | null,
    companyId: string,
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<number> {
    requirePermission(buildPipeline(ctx, 'create', companyId));

    const templates = await agreementTemplateService.list(ctx, scope, { active_only: true });
    const autoTemplates = templates.filter(t => {
      if (!t.auto_send_on_admission) return false;
      const posMatch = t.applies_to_positions.length === 0 ||
        (positionId && t.applies_to_positions.includes(positionId));
      const deptMatch = t.applies_to_departments.length === 0 ||
        (departmentId && t.applies_to_departments.includes(departmentId));
      return posMatch && deptMatch;
    });

    let dispatched = 0;
    for (const template of autoTemplates) {
      try {
        await this.sendForSignature({
          employee_id: employeeId,
          template_id: template.id,
          company_id: companyId,
        }, ctx);
        dispatched++;
      } catch (err) {
        console.error(`[AssignmentService] Auto-dispatch failed for template ${template.id}:`, err);
      }
    }

    if (dispatched > 0) {
      emitAgreementEvent({
        type: 'agreement.auto_dispatch_triggered',
        tenant_id: ctx.tenant_id,
        employee_id: employeeId,
        payload: { dispatched, total_templates: autoTemplates.length },
        timestamp: new Date().toISOString(),
      });
    }

    return dispatched;
  },

  // ── CANCEL ──

  async cancel(agreementId: string, ctx: SecurityContext): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const { data: agr } = await supabase
      .from('employee_agreements')
      .select('external_document_id, signature_provider, status')
      .eq('id', agreementId)
      .single();

    if (!agr) throw new Error('Acordo não encontrado.');
    const a = agr as any;
    if (a.status === 'signed') throw new Error('Não é possível cancelar um documento já assinado.');

    if (a.external_document_id && a.signature_provider) {
      await digitalSignatureAdapter.cancel(a.signature_provider, a.external_document_id);
    }

    const { error } = await supabase
      .from('employee_agreements')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() } as any)
      .eq('id', agreementId);

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.cancelled',
      tenant_id: ctx.tenant_id,
      agreement_id: agreementId,
      payload: {},
      timestamp: new Date().toISOString(),
    });
  },

  // ── DASHBOARD STATS ──

  async getDashboardStats(ctx: SecurityContext, scope: QueryScope): Promise<AgreementDashboardStats> {
    requirePermission(buildPipeline(ctx, 'view'));

    const [{ data: templates }, { data: agreements }] = await Promise.all([
      applyScope(supabase.from('agreement_templates').select('id, is_active, is_mandatory'), scope),
      applyScope(supabase.from('employee_agreements').select('id, status, template_id, signed_at, created_at'), scope),
    ]);

    const allTemplates = (templates || []) as any[];
    const allAgreements = (agreements || []) as any[];

    const byStatus: Record<AgreementStatus, number> = {
      pending: 0, sent: 0, viewed: 0, signed: 0,
      refused: 0, expired: 0, cancelled: 0,
    };
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    let signedThisMonth = 0;

    for (const a of allAgreements) {
      byStatus[a.status as AgreementStatus] = (byStatus[a.status as AgreementStatus] || 0) + 1;
      if (a.status === 'signed' && a.signed_at && a.signed_at >= monthStart) signedThisMonth++;
    }

    const mandatoryIds = new Set(allTemplates.filter(t => t.is_mandatory && t.is_active).map(t => t.id));
    const mandatoryAgreements = allAgreements.filter(a => mandatoryIds.has(a.template_id));
    const mandatorySigned = mandatoryAgreements.filter(a => a.status === 'signed').length;
    const complianceRate = mandatoryAgreements.length > 0
      ? (mandatorySigned / mandatoryAgreements.length) * 100
      : 100;

    return {
      total_templates: allTemplates.length,
      active_templates: allTemplates.filter(t => t.is_active).length,
      total_agreements: allAgreements.length,
      by_status: byStatus,
      pending_signatures: byStatus.pending + byStatus.sent + byStatus.viewed,
      signed_this_month: signedThisMonth,
      compliance_rate: Math.round(complianceRate * 10) / 10,
    };
  },
};
