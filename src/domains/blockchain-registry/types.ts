/**
 * Blockchain Proof Entity — Types
 *
 * No PII is stored — only document hashes and chain metadata.
 */

export interface BlockchainProof {
  id: string;
  tenant_id: string;
  signed_document_id: string;
  hash_sha256: string;
  blockchain_network: string;
  transaction_hash: string | null;
  block_number: number | null;
  timestamp_blockchain: string;
  status: BlockchainProofStatus;
  verification_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export type BlockchainProofStatus = 'pending' | 'confirmed' | 'failed';

export interface AnchorDocumentDTO {
  tenant_id: string;
  signed_document_id: string;
  hash_sha256: string;
  created_by?: string;
}

export interface AnchorResult {
  success: boolean;
  record?: BlockchainProof;
  error?: string;
}

export interface VerifyHashResult {
  found: boolean;
  confirmed: boolean;
  record?: BlockchainProof;
  verification_url?: string;
}
