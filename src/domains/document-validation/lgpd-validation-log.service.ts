/**
 * LGPD Validation Log Service
 *
 * Typed access to document_access_logs for LGPD audit compliance.
 * Every public document validation attempt is logged with requester identity.
 */

import { supabase } from '@/integrations/supabase/client';

export interface LGPDValidationLog {
  id: string;
  token_id: string;
  signed_document_id: string | null;
  tenant_id: string;
  nome: string | null;
  email: string | null;
  finalidade: string | null;
  ip: string | null;
  user_agent: string | null;
  timestamp: string;
  access_result: string;
  privacy_accepted: boolean;
}

function toLog(row: any): LGPDValidationLog {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    token_id: row.token_id,
    signed_document_id: row.signed_document_id ?? null,
    tenant_id: row.tenant_id,
    nome: row.requester_name ?? null,
    email: row.requester_email ?? meta.requester_email ?? null,
    finalidade: row.requester_purpose ?? null,
    ip: row.ip_address ?? null,
    user_agent: row.user_agent ?? null,
    timestamp: row.accessed_at,
    access_result: row.access_result,
    privacy_accepted: meta.privacy_accepted === true,
  };
}

export const lgpdValidationLogService = {

  /** List all LGPD validation logs for a tenant. */
  async list(tenantId: string, limit = 200): Promise<LGPDValidationLog[]> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('accessed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(toLog);
  },

  /** List logs for a specific signed document. */
  async listByDocument(signedDocumentId: string, tenantId: string): Promise<LGPDValidationLog[]> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('*')
      .eq('signed_document_id', signedDocumentId)
      .eq('tenant_id', tenantId)
      .order('accessed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toLog);
  },

  /** List logs for a specific validation token. */
  async listByToken(tokenId: string, tenantId: string): Promise<LGPDValidationLog[]> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('*')
      .eq('token_id', tokenId)
      .eq('tenant_id', tenantId)
      .order('accessed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toLog);
  },

  /** Get LGPD compliance summary for a tenant. */
  async getComplianceSummary(tenantId: string): Promise<{
    total_accesses: number;
    unique_requesters: number;
    successful_validations: number;
    failed_validations: number;
  }> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('access_result, requester_email')
      .eq('tenant_id', tenantId);

    if (error) throw error;
    const rows = data || [];
    const emails = new Set(rows.map((r: any) => r.requester_email).filter(Boolean));

    return {
      total_accesses: rows.length,
      unique_requesters: emails.size,
      successful_validations: rows.filter((r: any) => r.access_result === 'success').length,
      failed_validations: rows.filter((r: any) => r.access_result !== 'success').length,
    };
  },
};
