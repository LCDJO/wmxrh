/**
 * Blockchain Hash Registry — Service
 *
 * Manages anchoring of document hashes and verification.
 * Delegates actual blockchain interaction to the edge function.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  BlockchainProof,
  AnchorDocumentDTO,
  AnchorResult,
  VerifyHashResult,
} from './types';

function toRecord(row: any): BlockchainProof {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    signed_document_id: row.signed_document_id,
    hash_sha256: row.hash_sha256,
    blockchain_network: row.blockchain_network,
    transaction_hash: row.transaction_hash,
    block_number: row.block_number,
    timestamp_blockchain: row.timestamp_blockchain,
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
      body: {
        tenant_id: dto.tenant_id,
        signed_document_id: dto.signed_document_id,
        document_hash: dto.hash_sha256,
        created_by: dto.created_by,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data as AnchorResult;
  },

  /**
   * Verify if a document hash has been confirmed on chain.
   */
  async verifyByHash(hashSha256: string, tenantId: string): Promise<VerifyHashResult> {
    const { data, error } = await supabase
      .from('blockchain_hash_registry')
      .select('*')
      .eq('hash_sha256', hashSha256)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { found: false, confirmed: false };
    }

    const record = toRecord(data[0]);
    return {
      found: true,
      confirmed: record.status === 'confirmed',
      record,
      verification_url: record.verification_url ?? undefined,
    };
  },

  /**
   * List all blockchain proofs for a signed document.
   */
  async listByDocument(signedDocumentId: string, tenantId: string): Promise<BlockchainProof[]> {
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
   * List all blockchain proofs for a tenant (dashboard).
   */
  async listByTenant(tenantId: string, limit = 100): Promise<BlockchainProof[]> {
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
    confirmed: number;
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
      confirmed: rows.filter((r: any) => r.status === 'confirmed').length,
      pending: rows.filter((r: any) => r.status === 'pending').length,
      failed: rows.filter((r: any) => r.status === 'failed').length,
    };
  },
};
