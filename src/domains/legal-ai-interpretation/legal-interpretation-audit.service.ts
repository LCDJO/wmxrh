/**
 * Legal Interpretation Audit Service
 *
 * Append-only audit trail for legal AI interpretations.
 * Uses SECURITY DEFINER function to enforce immutability.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface LegalInterpretationLogEntry {
  id: string;
  tenant_id: string;
  mudanca_id: string;
  norm_codigo: string | null;
  resumo: string;
  impacto: Record<string, unknown>;
  acoes_geradas: Record<string, unknown>[];
  risco_nivel: string;
  modelo_utilizado: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateLegalInterpretationLog {
  tenant_id: string;
  mudanca_id: string;
  norm_codigo?: string;
  resumo: string;
  impacto: Record<string, unknown>;
  acoes_geradas: Record<string, unknown>[];
  risco_nivel?: string;
  modelo_utilizado?: string;
}

/** Insert a new interpretation log entry (append-only via SECURITY DEFINER). */
export async function insertLegalInterpretationLog(
  entry: CreateLegalInterpretationLog,
): Promise<string> {
  const { data, error } = await supabase.rpc('insert_legal_interpretation_log', {
    p_tenant_id: entry.tenant_id,
    p_mudanca_id: entry.mudanca_id,
    p_norm_codigo: entry.norm_codigo ?? '',
    p_resumo: entry.resumo,
    p_impacto: entry.impacto as unknown as Json,
    p_acoes_geradas: entry.acoes_geradas as unknown as Json,
    p_risco_nivel: entry.risco_nivel ?? 'medio',
    p_modelo_utilizado: entry.modelo_utilizado ?? undefined,
  });

  if (error) throw new Error(`[LegalInterpretationLog] insert failed: ${error.message}`);
  return data as string;
}

/** Query interpretation logs for a tenant (read-only). */
export async function fetchLegalInterpretationLogs(
  tenantId: string,
  opts?: { limit?: number; mudancaId?: string },
): Promise<LegalInterpretationLogEntry[]> {
  let query = supabase
    .from('legal_interpretation_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (opts?.mudancaId) query = query.eq('mudanca_id', opts.mudancaId);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`[LegalInterpretationLog] fetch failed: ${error.message}`);
  return (data ?? []) as unknown as LegalInterpretationLogEntry[];
}
