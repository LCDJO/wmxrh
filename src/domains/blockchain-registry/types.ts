/**
 * Blockchain Hash Registry — Types
 *
 * No PII is stored — only document hashes and chain metadata.
 */

export interface BlockchainHashRecord {
  id: string;
  tenant_id: string;
  signed_document_id: string;
  document_hash: string;
  chain: string;
  tx_hash: string | null;
  block_number: number | null;
  anchor_timestamp: string;
  status: BlockchainAnchorStatus;
  verification_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export type BlockchainAnchorStatus = 'pending' | 'anchored' | 'failed';

export interface AnchorDocumentDTO {
  tenant_id: string;
  signed_document_id: string;
  document_hash: string;
  created_by?: string;
}

export interface AnchorResult {
  success: boolean;
  record?: BlockchainHashRecord;
  error?: string;
}

export interface VerifyHashResult {
  found: boolean;
  anchored: boolean;
  record?: BlockchainHashRecord;
  verification_url?: string;
}
