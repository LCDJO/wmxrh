/**
 * Blockchain Hash Registry — Service
 *
 * Manages anchoring of document hashes and verification.
 * Delegates actual blockchain interaction to the edge function.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  BlockchainHashRecord,
  AnchorDocumentDTO,
  AnchorResult,
  VerifyHashResult,
} from './types';

function toRecord(row: any): BlockchainHashRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    signed_document_id: row.signed_document_id,
    document_hash: row.document_hash,
    chain: row.chain,
    tx_hash: row.tx_hash,
    block_number: row.block_number,
    anchor_timestamp: row.anchor_timestamp,
    status: row.status,
    verification_url: row.verification_url,
    metadata: row.metadata,
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

export const blockchainRegistryService = {
  /**
   * Anchor a document hash via edge function.
   */
  async anchor(dto: AnchorDocumentDTO): Promise<AnchorResult> {
    const { data, error } = await supabase.functions.invoke('blockchain-anchor', {
      body: dto,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data as AnchorResult;
  },

  /**
   * Verify if a document hash has been anchored.
   */
  async verifyByHash(documentHash: string, tenantId: string): Promise<VerifyHashResult> {
    const { data, error } = await supabase
      .from('blockchain_hash_registry')
      .select('*')
      .eq('document_hash', documentHash)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { found: false, anchored: false };
    }

    const record = toRecord(data[0]);
    return {
      found: true,
      anchored: record.status === 'anchored',
      record,
      verification_url: record.verification_url ?? undefined,
    };
  },

  /**
   * List all blockchain records for a signed document.
   */
  async listByDocument(signedDocumentId: string, tenantId: string): Promise<BlockchainHashRecord[]> {
    const { data, error } = await supabase
      .from('blockchain_hash_registry')
      .select('*')
      .eq('signed_document_id', signedDocumentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(toRecord);
  },

  /**
   * List all blockchain records for a tenant (dashboard).
   */
  async listByTenant(tenantId: string, limit = 100): Promise<BlockchainHashRecord[]> {
    const { data, error } = await supabase
      .from('blockchain_hash_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(toRecord);
  },

  /**
   * Get summary stats for dashboard.
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    anchored: number;
    pending: number;
    failed: number;
  }> {
    const { data, error } = await supabase
      .from('blockchain_hash_registry')
      .select('status')
      .eq('tenant_id', tenantId);

    if (error) throw error;
    const rows = data || [];
    return {
      total: rows.length,
      anchored: rows.filter((r: any) => r.status === 'anchored').length,
      pending: rows.filter((r: any) => r.status === 'pending').length,
      failed: rows.filter((r: any) => r.status === 'failed').length,
    };
  },
};
