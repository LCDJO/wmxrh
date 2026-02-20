/**
 * eSocial Governance — Audit Log Service
 *
 * Append-only audit trail for all eSocial governance actions.
 * No updates or deletes — immutable by design (enforced via RLS).
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ── Types ──

export interface EsocialGovernanceLogEntry {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  acao: string;
  evento: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateLogInput {
  tenant_id: string;
  empresa_id?: string | null;
  acao: string;
  evento?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ── Write ──

export async function logEsocialGovernanceAction(input: CreateLogInput): Promise<void> {
  const { error } = await supabase.from('esocial_governance_logs').insert([{
    tenant_id: input.tenant_id,
    empresa_id: input.empresa_id ?? null,
    acao: input.acao,
    evento: input.evento ?? null,
    status: input.status ?? 'info',
    metadata: (input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : {}) as Json,
  }]);

  if (error) {
    console.error('[eSocialGovAudit] Failed to log:', error.message);
    throw error;
  }
}

// ── Read ──

export async function fetchEsocialGovernanceLogs(
  tenantId: string,
  opts?: { empresa_id?: string; limit?: number; offset?: number },
): Promise<EsocialGovernanceLogEntry[]> {
  let query = supabase
    .from('esocial_governance_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.empresa_id) {
    query = query.eq('empresa_id', opts.empresa_id);
  }
  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    tenant_id: row.tenant_id,
    empresa_id: row.empresa_id,
    acao: row.acao,
    evento: row.evento,
    status: row.status,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  }));
}
