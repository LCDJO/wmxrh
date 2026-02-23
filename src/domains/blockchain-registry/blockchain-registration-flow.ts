/**
 * Blockchain Registration Flow
 *
 * SECURITY GUARANTEES:
 *   ✓ NEVER sends document content to blockchain — only SHA-256 hash
 *   ✓ Async queue-based registration with automatic retry
 *   ✓ Exponential backoff: 30s → 2m → 8m → 32m → 2h
 *   ✓ Dead-letter after 5 failed attempts
 *   ✓ Idempotent — duplicate hashes are detected before enqueuing
 *
 * Flow:
 *   1. Generate SHA-256 hash from document content (client-side)
 *   2. Check idempotency (already anchored?)
 *   3. Enqueue hash-only job in blockchain_anchor_queue
 *   4. Queue processor picks up async and calls blockchain-anchor
 *   5. Retry automatically on failure with exponential backoff
 */

import { supabase } from '@/integrations/supabase/client';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import { blockchainRegistryService } from './blockchain-registry.service';
import type { BlockchainProof } from './types';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface RegistrationFlowInput {
  /** Tenant scope */
  tenant_id: string;
  /** Reference to the signed document record */
  signed_document_id: string;
  /** Raw content to hash (JSON-serialized document payload) — NEVER sent to chain */
  document_content: string;
  /** User who triggered the signature */
  created_by?: string;
}

export interface RegistrationFlowResult {
  success: boolean;
  /** The blockchain proof record (if already confirmed) */
  proof?: BlockchainProof;
  /** SHA-256 hash that was enqueued */
  hash_sha256?: string;
  /** Queue job ID for tracking */
  queue_id?: string;
  /** Transaction hash on chain (only if already confirmed) */
  transaction_hash?: string;
  /** Current status */
  status?: 'queued' | 'confirmed' | 'failed';
  error?: string;
}

// ═══════════════════════════════════════════════════════
// ASYNC QUEUE-BASED REGISTRATION
// ═══════════════════════════════════════════════════════

/**
 * Enqueue a document hash for async blockchain registration.
 *
 * SECURITY:
 *   - Only the SHA-256 hash is stored in the queue
 *   - document_content is used locally to compute the hash, then discarded
 *   - The queue processor sends ONLY the hash to the blockchain
 */
export async function executeBlockchainRegistration(
  input: RegistrationFlowInput
): Promise<RegistrationFlowResult> {
  try {
    // ─── Step 1: Generate SHA-256 hash (local only) ───
    const hash = await generateDocumentHash(input.document_content);
    // document_content is NOT stored or transmitted beyond this point

    // ─── Step 2: Idempotency check ───
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

    // ─── Step 3: Check if already enqueued ───
    const { data: existingJob } = await supabase
      .from('blockchain_anchor_queue' as any)
      .select('id, status')
      .eq('hash_sha256', hash)
      .eq('tenant_id', input.tenant_id)
      .in('status', ['queued', 'processing', 'failed'])
      .maybeSingle();

    if (existingJob) {
      return {
        success: true,
        hash_sha256: hash,
        queue_id: (existingJob as any).id,
        status: 'queued',
      };
    }

    // ─── Step 4: Enqueue hash-only job ───
    const { data: job, error: insertError } = await supabase
      .from('blockchain_anchor_queue' as any)
      .insert({
        tenant_id: input.tenant_id,
        signed_document_id: input.signed_document_id,
        hash_sha256: hash, // ONLY the hash — no document content
        created_by: input.created_by,
      })
      .select('id')
      .single();

    if (insertError) {
      return {
        success: false,
        hash_sha256: hash,
        status: 'failed',
        error: `Failed to enqueue: ${insertError.message}`,
      };
    }

    return {
      success: true,
      hash_sha256: hash,
      queue_id: (job as any)?.id,
      status: 'queued',
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
 * Enqueue a pre-computed hash (skip hash generation).
 *
 * SECURITY: Only the hash is stored — caller must ensure
 * no PII or document content leaks into this function.
 */
export async function registerPrecomputedHash(
  tenantId: string,
  signedDocumentId: string,
  hashSha256: string,
  createdBy?: string,
): Promise<RegistrationFlowResult> {
  try {
    // Idempotency
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

    // Check existing queue job
    const { data: existingJob } = await supabase
      .from('blockchain_anchor_queue' as any)
      .select('id, status')
      .eq('hash_sha256', hashSha256)
      .eq('tenant_id', tenantId)
      .in('status', ['queued', 'processing', 'failed'])
      .maybeSingle();

    if (existingJob) {
      return {
        success: true,
        hash_sha256: hashSha256,
        queue_id: (existingJob as any).id,
        status: 'queued',
      };
    }

    // Enqueue
    const { data: job, error } = await supabase
      .from('blockchain_anchor_queue' as any)
      .insert({
        tenant_id: tenantId,
        signed_document_id: signedDocumentId,
        hash_sha256: hashSha256,
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, hash_sha256: hashSha256, status: 'failed', error: error.message };
    }

    return {
      success: true,
      hash_sha256: hashSha256,
      queue_id: (job as any)?.id,
      status: 'queued',
    };
  } catch (err) {
    return { success: false, hash_sha256: hashSha256, status: 'failed', error: String(err) };
  }
}

/**
 * Get queue status for a specific document.
 */
export async function getQueueStatus(
  signedDocumentId: string,
  tenantId: string,
): Promise<{ status: string; attempt_count: number; last_error?: string; proof_id?: string } | null> {
  const { data } = await supabase
    .from('blockchain_anchor_queue' as any)
    .select('status, attempt_count, last_error, proof_id')
    .eq('signed_document_id', signedDocumentId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as any ?? null;
}
