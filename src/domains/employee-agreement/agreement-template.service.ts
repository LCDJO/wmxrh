/**
 * AgreementTemplateService
 *
 * Manages agreement template CRUD and versioning (append-only).
 * Templates define terms, policies, and conditions that employees must sign.
 *
 * ╔══════════════════════════════════════════════════╗
 * ║  tenant_id always derived from SecurityContext   ║
 * ╚══════════════════════════════════════════════════╝
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, type QueryScope } from '@/domains/shared/scoped-query';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import { emitAgreementEvent } from './events';
import type {
  AgreementTemplate,
  AgreementTemplateVersion,
  CreateTemplateDTO,
  CreateVersionDTO,
} from './types';

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
    guardTarget: { tenantId: ctx.tenant_id, companyId: companyId ?? undefined },
  };
}

export const agreementTemplateService = {

  async create(dto: CreateTemplateDTO, ctx: SecurityContext): Promise<AgreementTemplate> {
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

  async list(
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

  async getById(id: string, ctx: SecurityContext): Promise<AgreementTemplate | null> {
    requirePermission(buildPipeline(ctx, 'view'));

    const { data, error } = await supabase
      .from('agreement_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as unknown as AgreementTemplate;
  },

  async update(
    id: string,
    updates: Partial<CreateTemplateDTO>,
    ctx: SecurityContext,
  ): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const { error } = await supabase
      .from('agreement_templates')
      .update(updates as any)
      .eq('id', id);

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.template.updated',
      tenant_id: ctx.tenant_id,
      template_id: id,
      payload: updates,
      timestamp: new Date().toISOString(),
    });
  },

  // ── VERSIONING (append-only, immutable) ──

  async publishVersion(dto: CreateVersionDTO, ctx: SecurityContext): Promise<AgreementTemplateVersion> {
    requirePermission(buildPipeline(ctx, 'update'));

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

  async getVersions(templateId: string, ctx: SecurityContext): Promise<AgreementTemplateVersion[]> {
    requirePermission(buildPipeline(ctx, 'view'));

    const { data, error } = await supabase
      .from('agreement_template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as AgreementTemplateVersion[];
  },

  async getCurrentVersion(templateId: string): Promise<AgreementTemplateVersion | null> {
    const { data } = await supabase
      .from('agreement_template_versions')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_current', true)
      .limit(1);

    if (!data || data.length === 0) return null;
    return data[0] as unknown as AgreementTemplateVersion;
  },
};
