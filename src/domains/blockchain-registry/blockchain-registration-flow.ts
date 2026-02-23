/**
 * Blockchain Registration Flow
 *
 * Orchestrates the full lifecycle when a document signature is finalized:
 *   1. Generate SHA-256 hash of signed content
 *   2. Send hash to smart contract (via edge function)
 *   3. Await confirmation (webhook-based for production)
 *   4. Save transaction_hash
 *   5. Update status → confirmed | failed
 *
 * This flow is designed to be called post-signature from any domain
 * (EPI, Employee Agreements, Legal Documents, etc.)
 */

import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import { blockchainRegistryService } from './blockchain-registry.service';
import type { BlockchainProof, AnchorResult } from './types';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface RegistrationFlowInput {
  /** Tenant scope */
  tenant_id: string;
  /** Reference to the signed document record */
  signed_document_id: string;
  /** Raw content to hash (JSON-serialized document payload) */
  document_content: string;
  /** User who triggered the signature */
  created_by?: string;
}

export interface RegistrationFlowResult {
  success: boolean;
  /** The blockchain proof record (if anchored) */
  proof?: BlockchainProof;
  /** SHA-256 hash that was anchored */
  hash_sha256?: string;
  /** Transaction hash on chain */
  transaction_hash?: string;
  /** Final status */
  status?: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

// ═══════════════════════════════════════════════════════
// REGISTRATION FLOW
// ═══════════════════════════════════════════════════════

/**
 * Execute the full blockchain registration flow.
 *
 * Steps:
 *   1. Generate SHA-256 hash from document content
 *   2. Check if hash is already anchored (idempotent)
 *   3. Send hash to blockchain-anchor edge function
 *   4. Return proof with transaction_hash and status
 *
 * The edge function handles the smart contract interaction
 * and returns the confirmation synchronously (simulated) or
 * sets status=pending for async webhook confirmation.
 */
export async function executeBlockchainRegistration(
  input: RegistrationFlowInput
): Promise<RegistrationFlowResult> {
  try {
    // ─── Step 1: Generate SHA-256 hash ───
    const hash = await generateDocumentHash(input.document_content);

    // ─── Step 2: Check idempotency ───
    const existing = await blockchainRegistryService.verifyByHash(hash, input.tenant_id);
    if (existing.found && existing.confirmed && existing.record) {
      return {
        success: true,
        proof: existing.record,
        hash_sha256: hash,
        transaction_hash: existing.record.transaction_hash ?? undefined,
        status: 'confirmed',
      };
    }

    // ─── Step 3: Send to blockchain via edge function ───
    const anchorResult: AnchorResult = await blockchainRegistryService.anchor({
      tenant_id: input.tenant_id,
      signed_document_id: input.signed_document_id,
      hash_sha256: hash,
      created_by: input.created_by,
    });

    if (!anchorResult.success) {
      return {
        success: false,
        hash_sha256: hash,
        status: 'failed',
        error: anchorResult.error ?? 'Anchor request failed',
      };
    }

    // ─── Step 4/5: Return proof with transaction_hash and status ───
    const proof = anchorResult.record;
    return {
      success: true,
      proof,
      hash_sha256: hash,
      transaction_hash: proof?.transaction_hash ?? undefined,
      status: proof?.status ?? 'pending',
    };
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      error: `Blockchain registration failed: ${String(err)}`,
    };
  }
}

/**
 * Convenience: register a pre-computed hash (skip step 1).
 */
export async function registerPrecomputedHash(
  tenantId: string,
  signedDocumentId: string,
  hashSha256: string,
  createdBy?: string,
): Promise<RegistrationFlowResult> {
  try {
    const existing = await blockchainRegistryService.verifyByHash(hashSha256, tenantId);
    if (existing.found && existing.confirmed && existing.record) {
      return {
        success: true,
        proof: existing.record,
        hash_sha256: hashSha256,
        transaction_hash: existing.record.transaction_hash ?? undefined,
        status: 'confirmed',
      };
    }

    const anchorResult = await blockchainRegistryService.anchor({
      tenant_id: tenantId,
      signed_document_id: signedDocumentId,
      hash_sha256: hashSha256,
      created_by: createdBy,
    });

    if (!anchorResult.success) {
      return { success: false, hash_sha256: hashSha256, status: 'failed', error: anchorResult.error };
    }

    const proof = anchorResult.record;
    return {
      success: true,
      proof,
      hash_sha256: hashSha256,
      transaction_hash: proof?.transaction_hash ?? undefined,
      status: proof?.status ?? 'pending',
    };
  } catch (err) {
    return { success: false, hash_sha256: hashSha256, status: 'failed', error: String(err) };
  }
}
