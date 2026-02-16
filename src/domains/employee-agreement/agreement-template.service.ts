/**
 * AgreementTemplateService
 *
 * Manages agreement template CRUD and versioning.
 * Templates define terms, policies, and conditions that employees must sign.
 *
 * Exemplos:
 *  - Termo de Uso de Imagem
 *  - Termo de Confidencialidade
 *  - Termo de Direção Veicular
 *  - Termo de EPI
 *  - Termo LGPD
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, type QueryScope } from '@/domains/shared/scoped-query';
import { requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import { emitAgreementEvent } from './events';
import type {
  AgreementTemplate,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  PublishNewVersionDTO,
} from './types';

function buildPipeline(
  ctx: SecurityContext,
  action: PipelineInput['action'],
): PipelineInput {
  return {
    action,
    resource: 'agreement_templates',
    ctx,
    guardTarget: { tenantId: ctx.tenant_id },
  };
}

/** Maps DB row → domain entity */
function toDomain(row: any): AgreementTemplate {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    nome_termo: row.name,
    descricao: row.description,
    tipo: row.category as AgreementTemplate['tipo'],
    obrigatorio: row.is_mandatory,
    cargo_id: row.cargo_id,
    versao: row.versao,
    conteudo_html: row.conteudo_html,
    ativo: row.is_active,
  };
}

export const agreementTemplateService = {

  async create(dto: CreateTemplateDTO, ctx: SecurityContext): Promise<AgreementTemplate> {
    requirePermission(buildPipeline(ctx, 'create'));

    const slug = dto.nome_termo
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const row = scopedInsertFromContext({
      name: dto.nome_termo,
      slug,
      description: dto.descricao ?? null,
      category: dto.tipo,
      is_mandatory: dto.obrigatorio ?? true,
      is_active: true,
      cargo_id: dto.cargo_id ?? null,
      versao: 1,
      conteudo_html: dto.conteudo_html,
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
      payload: { nome_termo: dto.nome_termo, tipo: dto.tipo },
      timestamp: new Date().toISOString(),
    });

    return toDomain(data);
  },

  async list(
    ctx: SecurityContext,
    scope: QueryScope,
    opts?: { tipo?: string; active_only?: boolean },
  ): Promise<AgreementTemplate[]> {
    requirePermission(buildPipeline(ctx, 'view'));

    let q = applyScope(
      supabase.from('agreement_templates').select('*'),
      scope,
    ).order('name');

    if (opts?.tipo) q = q.eq('category', opts.tipo);
    if (opts?.active_only !== false) q = q.eq('is_active', true);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(toDomain);
  },

  async getById(id: string, ctx: SecurityContext): Promise<AgreementTemplate | null> {
    requirePermission(buildPipeline(ctx, 'view'));

    const { data, error } = await supabase
      .from('agreement_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return toDomain(data);
  },

  async update(
    id: string,
    updates: UpdateTemplateDTO,
    ctx: SecurityContext,
  ): Promise<void> {
    requirePermission(buildPipeline(ctx, 'update'));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.nome_termo !== undefined) dbUpdates.name = updates.nome_termo;
    if (updates.descricao !== undefined) dbUpdates.description = updates.descricao;
    if (updates.tipo !== undefined) dbUpdates.category = updates.tipo;
    if (updates.obrigatorio !== undefined) dbUpdates.is_mandatory = updates.obrigatorio;
    if (updates.cargo_id !== undefined) dbUpdates.cargo_id = updates.cargo_id;
    if (updates.conteudo_html !== undefined) dbUpdates.conteudo_html = updates.conteudo_html;
    if (updates.ativo !== undefined) dbUpdates.is_active = updates.ativo;

    const { error } = await supabase
      .from('agreement_templates')
      .update(dbUpdates as any)
      .eq('id', id);

    if (error) throw error;

    emitAgreementEvent({

      type: 'agreement.template.updated',
      tenant_id: ctx.tenant_id,
      template_id: id,
      payload: updates as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
  },

  // ── VERSIONING ──

  async publishNewVersion(dto: PublishNewVersionDTO, ctx: SecurityContext): Promise<AgreementTemplate> {
    requirePermission(buildPipeline(ctx, 'update'));

    const current = await this.getById(dto.template_id, ctx);
    if (!current) throw new Error('Template não encontrado.');

    const nextVersion = current.versao + 1;

    // Also store in versions table for audit trail
    const versionRow = scopedInsertFromContext({
      template_id: dto.template_id,
      version_number: nextVersion,
      title: current.nome_termo,
      content_html: dto.conteudo_html,
      change_summary: dto.descricao_mudanca ?? null,
      is_current: true,
      published_at: new Date().toISOString(),
    }, ctx);

    // Unset previous current version
    await supabase
      .from('agreement_template_versions')
      .update({ is_current: false } as any)
      .eq('template_id', dto.template_id)
      .eq('is_current', true);

    // Insert new version record
    await supabase
      .from('agreement_template_versions')
      .insert([versionRow as any]);

    // Update template itself
    const { error } = await supabase
      .from('agreement_templates')
      .update({ versao: nextVersion, conteudo_html: dto.conteudo_html } as any)
      .eq('id', dto.template_id);

    if (error) throw error;

    emitAgreementEvent({
      type: 'agreement.template.version_published',
      tenant_id: ctx.tenant_id,
      template_id: dto.template_id,
      payload: { versao: nextVersion },
      timestamp: new Date().toISOString(),
    });

    return { ...current, versao: nextVersion, conteudo_html: dto.conteudo_html };
  },

  /** Get current version's content (from the template itself) */
  async getCurrentVersion(templateId: string): Promise<{ id: string; version_number: number; content_html: string; title: string } | null> {
    const { data } = await supabase
      .from('agreement_templates')
      .select('id, versao, conteudo_html, name')
      .eq('id', templateId)
      .single();

    if (!data) return null;
    return {
      id: (data as any).id,
      version_number: (data as any).versao,
      content_html: (data as any).conteudo_html,
      title: (data as any).name,
    };
  },
};
