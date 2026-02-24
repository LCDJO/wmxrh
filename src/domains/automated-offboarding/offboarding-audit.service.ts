/**
 * OffboardingAuditLog Service
 *
 * Complete audit trail for offboarding workflows:
 *   - etapa (stage)
 *   - usuario (actor)
 *   - timestamp
 *   - decisão (decision)
 *   - justificativa (justification)
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface OffboardingAuditEntry {
  id: string;
  workflow_id: string;
  tenant_id: string;
  action: string;
  actor_id: string | null;
  etapa: string | null;
  decisao: string | null;
  justificativa: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RecordAuditParams {
  tenant_id: string;
  workflow_id: string;
  action: string;
  actor_id?: string | null;
  etapa?: string | null;
  decisao?: string | null;
  justificativa?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

// ── Action Labels ──

export const OFFBOARDING_AUDIT_ACTIONS: Record<string, string> = {
  'workflow.created': 'Workflow Criado',
  'workflow.status_changed': 'Status Alterado',
  'workflow.completed': 'Workflow Finalizado',
  'workflow.cancelled': 'Workflow Cancelado',
  'checklist.item_completed': 'Item Checklist Concluído',
  'checklist.item_skipped': 'Item Checklist Pulado',
  'checklist.generated': 'Checklist Gerado',
  'reference_letter.evaluated': 'Carta de Referência Avaliada',
  'reference_letter.approved': 'Carta de Referência Aprovada',
  'reference_letter.rejected': 'Carta de Referência Rejeitada',
  'reference_letter.signed': 'Carta de Referência Assinada',
  'reference_letter.document_generated': 'Documento Gerado',
  'archive.created': 'Perfil Arquivado',
  'archive.anonymized': 'Perfil Anonimizado (LGPD)',
  'esocial.xml_generated': 'XML eSocial Gerado',
  'esocial.event_sent': 'Evento eSocial Enviado',
  'esocial.event_confirmed': 'Evento eSocial Confirmado',
  'pendency.detected': 'Pendência Detectada',
  'pendency.resolved': 'Pendência Resolvida',
  'freeze.applied': 'Bloqueio Operacional Aplicado',
  'freeze.released': 'Bloqueio Operacional Liberado',
  'rescission.calculated': 'Rescisão Calculada',
  'rescission.approved': 'Rescisão Aprovada',
};

export const OFFBOARDING_ETAPAS: Record<string, string> = {
  'bloqueio_operacional': 'Bloqueio Operacional',
  'validacao_pendencias': 'Validação de Pendências',
  'calculo_rescisao': 'Cálculo de Rescisão',
  'esocial': 'eSocial',
  'documentos': 'Documentos',
  'carta_referencia': 'Carta de Referência',
  'arquivamento': 'Arquivamento',
  'lgpd': 'LGPD',
  'finalizacao': 'Finalização',
};

export const DECISAO_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'aprovado': 'default',
  'concluido': 'default',
  'rejeitado': 'destructive',
  'cancelado': 'destructive',
  'pendente': 'outline',
  'automatico': 'secondary',
};

// ── Write ──

export async function recordOffboardingAudit(params: RecordAuditParams): Promise<void> {
  const { error } = await supabase.from('offboarding_audit_log').insert({
    tenant_id: params.tenant_id,
    workflow_id: params.workflow_id,
    action: params.action,
    actor_id: params.actor_id ?? null,
    etapa: params.etapa ?? null,
    decisao: params.decisao ?? null,
    justificativa: params.justificativa ?? null,
    old_value: params.old_value ?? null,
    new_value: params.new_value ?? null,
    metadata: params.metadata ?? null,
  } as any);

  if (error) {
    console.error('[OffboardingAudit] Failed to persist:', error.message);
  }
}

// ── Read ──

export async function listOffboardingAuditLog(
  tenantId: string,
  workflowId?: string,
  opts?: { limit?: number },
): Promise<OffboardingAuditEntry[]> {
  let query = supabase
    .from('offboarding_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200);

  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map(row => ({
    id: row.id,
    workflow_id: row.workflow_id,
    tenant_id: row.tenant_id,
    action: row.action,
    actor_id: row.actor_id,
    etapa: (row as any).etapa ?? null,
    decisao: (row as any).decisao ?? null,
    justificativa: (row as any).justificativa ?? null,
    old_value: (row.old_value ?? null) as Record<string, unknown> | null,
    new_value: (row.new_value ?? null) as Record<string, unknown> | null,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    created_at: row.created_at,
  }));
}

export const offboardingAuditService = {
  record: recordOffboardingAudit,
  list: listOffboardingAuditLog,
};
