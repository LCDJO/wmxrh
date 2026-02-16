/**
 * Employee Agreement Engine — Application Service
 *
 * Orchestrates template management, versioning, signature dispatch,
 * and document storage lifecycle.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SECURITY: All operations go through SecurityKernel     ║
 * ║  - tenant_id derived from SecurityContext               ║
 * ║  - company scope validated via requirePermission        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, type QueryScope } from '@/domains/shared/scoped-query';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import { emitAgreementEvent } from './events';
import { getSignatureProvider, type IDocumentStorage } from './ports';
import type {
  AgreementTemplate,
  AgreementTemplateVersion,
  EmployeeAgreement,
  CreateTemplateDTO,
  CreateVersionDTO,
  SendForSignatureDTO,
  SignatureCallbackDTO,
  AgreementDashboardStats,
  AgreementStatus,
  SignatureProvider,
} from './types';

// ── Security Helper ──

function buildPipeline(
  ctx: SecurityContext,
  action: PipelineInput['action'],
  companyId?: string | null,
): PipelineInput {
  return {
    action,
    resource: 'agreement_templates',
    ctx,
    target: companyId ? { company_id: companyId } : undefined,
    guardTarget: {
      tenantId: ctx.tenant_id,
      companyId: companyId ?? undefined,
    },
  };
}

// ── Storage reference (injected) ──
let docStorage: IDocumentStorage | null = null;

export function setDocumentStorage(storage: IDocumentStorage): void {
  docStorage = storage;
}

// ══════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════

export const agreementEngineService = {

  // ── TEMPLATES ──

  async createTemplate(
    dto: CreateTemplateDTO,
    ctx: SecurityContext,
  ): Promise<AgreementTemplate> {
    requirePermission(buildPipeline(ctx, 'create', dto.company_id));

    const row = scopedInsertFromContext({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      category: dto.category,
      applies_to_positions: dto.applies_to_positions ?? [],
      applies_to_departments: dto.applies_to_departments ?? [],
      is_mandatory: dto.is_mandatory ?? true,
      auto_send_on_admission: dto.auto_send_on_admission ?? false,
      requires_witness: dto.requires_witness ?? false,
      expiry_days: dto.expiry_days ?? null,
      company_id: dto.company_id ?? null,
      company_group_id: dto.company_group_id ?? null,
    }, ctx);

    const { data, error } = await supabase
      .from('agreement_templates')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.template.created',
      tenant_id: ctx.tenant_id,
      template_id: data.id,
      payload: { name: dto.name, category: dto.category },
      timestamp: new Date().toISOString(),
    });

    return data as unknown as AgreementTemplate;
  },

  async listTemplates(
    ctx: SecurityContext,
    scope: QueryScope,
    opts?: { category?: string; active_only?: boolean },
  ): Promise<AgreementTemplate[]> {
    requirePermission(buildPipeline(ctx, 'view'));

    let q = applyScope(
      supabase.from('agreement_templates').select('*'),
      scope,
    ).order('name');

    if (opts?.category) q = q.eq('category', opts.category);
    if (opts?.active_only !== false) q = q.eq('is_active', true);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as AgreementTemplate[];
  },

  // ── VERSIONING ──

  async publishVersion(
    dto: CreateVersionDTO,
    ctx: SecurityContext,
  ): Promise<AgreementTemplateVersion> {
    requirePermission(buildPipeline(ctx, 'update'));

    // Get next version number
    const { data: existing } = await supabase
      .from('agreement_template_versions')
      .select('version_number')
      .eq('template_id', dto.template_id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0
      ? (existing[0] as any).version_number + 1
      : 1;

    // Unset previous current
    await supabase
      .from('agreement_template_versions')
      .update({ is_current: false } as any)
      .eq('template_id', dto.template_id)
      .eq('is_current', true);

    const row = scopedInsertFromContext({
      template_id: dto.template_id,
      version_number: nextVersion,
      title: dto.title,
      content_html: dto.content_html,
      content_plain: dto.content_plain ?? null,
      change_summary: dto.change_summary ?? null,
      is_current: true,
      published_at: dto.publish_immediately !== false ? new Date().toISOString() : null,
    }, ctx);

    const { data, error } = await supabase
      .from('agreement_template_versions')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.template.version_published',
      tenant_id: ctx.tenant_id,
      template_id: dto.template_id,
      payload: { version: nextVersion, title: dto.title },
      timestamp: new Date().toISOString(),
    });

    return data as unknown as AgreementTemplateVersion;
  },

  async getTemplateVersions(
    templateId: string,
    ctx: SecurityContext,
  ): Promise<AgreementTemplateVersion[]> {
    requirePermission(buildPipeline(ctx, 'view'));

    const { data, error } = await supabase
      .from('agreement_template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as AgreementTemplateVersion[];
  },

  // ── SEND FOR SIGNATURE ──

  async sendForSignature(
    dto: SendForSignatureDTO,
    ctx: SecurityContext,
  ): Promise<EmployeeAgreement> {
    requirePermission(buildPipeline(ctx, 'create', dto.company_id));

    // Get current version
    const { data: versions } = await supabase
      .from('agreement_template_versions')
      .select('*')
      .eq('template_id', dto.template_id)
      .eq('is_current', true)
      .limit(1);

    if (!versions || versions.length === 0) {
      throw new Error('Template não possui versão publicada.');
    }
    const version = versions[0] as any;

    // Get template for config
    const { data: template } = await supabase
      .from('agreement_templates')
      .select('*')
      .eq('id', dto.template_id)
      .single();

    if (!template) throw new Error('Template não encontrado.');

    // Get employee for signer info
    const { data: employee } = await supabase
      .from('employees')
      .select('name, email, cpf')
      .eq('id', dto.employee_id)
      .single();

    if (!employee) throw new Error('Colaborador não encontrado.');

    const providerName: SignatureProvider = dto.provider ?? 'simulation';
    const provider = getSignatureProvider(providerName);

    let externalDocId: string | null = null;
    let signingUrl: string | null = null;

    if (provider) {
      const result = await provider.sendForSignature({
        document_title: version.title,
        document_content_html: version.content_html,
        signer_name: employee.name,
        signer_email: employee.email ?? '',
        signer_cpf: employee.cpf ?? undefined,
        requires_witness: (template as any).requires_witness ?? false,
      });

      externalDocId = result.external_document_id;
      signingUrl = result.signing_url;
    }

    const expiryDays = (template as any).expiry_days;
    const expiresAt = expiryDays
      ? new Date(Date.now() + expiryDays * 86400000).toISOString()
      : null;

    const row = scopedInsertFromContext({
      employee_id: dto.employee_id,
      template_id: dto.template_id,
      template_version_id: version.id,
      company_id: dto.company_id ?? (template as any).company_id ?? null,
      company_group_id: (template as any).company_group_id ?? null,
      status: provider ? 'sent' : 'pending',
      signature_provider: providerName,
      external_document_id: externalDocId,
      external_signing_url: signingUrl,
      sent_at: provider ? new Date().toISOString() : null,
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

  async processSignatureCallback(
    dto: SignatureCallbackDTO,
    ctx: SecurityContext,
  ): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const update: Record<string, unknown> = {
      status: dto.status,
      ip_address: dto.ip_address,
      user_agent: dto.user_agent,
    };

    if (dto.status === 'signed') {
      update.signed_at = new Date().toISOString();
      update.signed_document_hash = dto.signed_document_hash;

      // Download and store signed document
      if (dto.signed_document_url && docStorage) {
        const { data: agreement } = await supabase
          .from('employee_agreements')
          .select('tenant_id')
          .eq('id', dto.agreement_id)
          .single();

        if (agreement) {
          try {
            const provider = getSignatureProvider(
              ((await supabase.from('employee_agreements').select('signature_provider').eq('id', dto.agreement_id).single()).data as any)?.signature_provider
            );
            if (provider) {
              const blob = await provider.downloadSignedDocument(dto.external_document_id);
              if (blob) {
                const storagePath = await docStorage.upload(
                  (agreement as any).tenant_id,
                  dto.agreement_id,
                  blob,
                  `signed_${dto.agreement_id}.pdf`,
                );
                update.signed_document_url = storagePath;
              }
            }
          } catch (err) {
            console.error('[AgreementEngine] Failed to store signed document:', err);
            update.signed_document_url = dto.signed_document_url; // fallback to external URL
          }
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

  // ── EMPLOYEE AGREEMENTS LIST ──

  async listEmployeeAgreements(
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

    const templates = await this.listTemplates(ctx, scope, { active_only: true });
    const autoTemplates = templates.filter(t => {
      if (!t.auto_send_on_admission) return false;
      // Check scope: general or matching position/department
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
        console.error(`[AgreementEngine] Auto-dispatch failed for template ${template.id}:`, err);
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

  // ── DASHBOARD STATS ──

  async getDashboardStats(
    ctx: SecurityContext,
    scope: QueryScope,
  ): Promise<AgreementDashboardStats> {
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let signedThisMonth = 0;

    for (const a of allAgreements) {
      byStatus[a.status as AgreementStatus] = (byStatus[a.status as AgreementStatus] || 0) + 1;
      if (a.status === 'signed' && a.signed_at && a.signed_at >= monthStart) {
        signedThisMonth++;
      }
    }

    const mandatoryTemplateIds = new Set(
      allTemplates.filter(t => t.is_mandatory && t.is_active).map(t => t.id),
    );
    const mandatoryAgreements = allAgreements.filter(a => mandatoryTemplateIds.has(a.template_id));
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

  // ── CANCEL ──

  async cancelAgreement(
    agreementId: string,
    ctx: SecurityContext,
  ): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const { data: agreement } = await supabase
      .from('employee_agreements')
      .select('external_document_id, signature_provider, status')
      .eq('id', agreementId)
      .single();

    if (!agreement) throw new Error('Acordo não encontrado.');
    const agr = agreement as any;
    if (agr.status === 'signed') throw new Error('Não é possível cancelar um documento já assinado.');

    // Cancel at provider if applicable
    if (agr.external_document_id && agr.signature_provider) {
      const provider = getSignatureProvider(agr.signature_provider);
      if (provider) {
        await provider.cancelSignature(agr.external_document_id);
      }
    }

    const { error } = await supabase
      .from('employee_agreements')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      } as any)
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
};
