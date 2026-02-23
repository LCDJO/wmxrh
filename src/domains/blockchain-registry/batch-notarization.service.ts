/**
 * Batch Notarization Service
 *
 * Periodic batch anchoring of pending document hashes.
 * Designed to be called by a scheduled job (cron).
 *
 * SECURITY:
 *   ✓ Only SHA-256 hashes are processed — NEVER document content
 *   ✓ Tenant isolation maintained throughout
 *   ✓ Batches are processed with configurable size limits
 *
 * Flow:
 *   1. Collect unanchored signed documents (no proof yet)
 *   2. Generate queue entries in batch
 *   3. Queue processor handles actual anchoring
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface BatchNotarizationConfig {
  /** Max documents per batch */
  batchSize: number;
  /** Only process documents older than N minutes */
  minAgeMinutes: number;
  /** Tenant scope (null = all tenants) */
  tenantId?: string;
}

export interface BatchNotarizationResult {
  processed: number;
  alreadyAnchored: number;
  enqueued: number;
  errors: number;
  details: Array<{
    signedDocumentId: string;
    status: 'enqueued' | 'already_anchored' | 'error';
    error?: string;
  }>;
}

const DEFAULT_CONFIG: BatchNotarizationConfig = {
  batchSize: 50,
  minAgeMinutes: 5,
};

// ═══════════════════════════════════════════════════════
// BATCH PROCESSING
// ═══════════════════════════════════════════════════════

/**
 * Find signed documents that have no blockchain proof yet
 * and enqueue them for anchoring.
 *
 * This is designed to catch any documents that were signed
 * but didn't get queued for blockchain registration (e.g.,
 * due to a transient error during the signing flow).
 */
export async function runBatchNotarization(
  config: Partial<BatchNotarizationConfig> = {},
): Promise<BatchNotarizationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result: BatchNotarizationResult = {
    processed: 0,
    alreadyAnchored: 0,
    enqueued: 0,
    errors: 0,
    details: [],
  };

  try {
    // Find signed agreements that have no blockchain proof
    let query = supabase
      .from('employee_agreements')
      .select('id, tenant_id, signed_document_hash, signed_at')
      .eq('status', 'signed')
      .not('signed_document_hash', 'is', null)
      .not('signed_at', 'is', null)
      .order('signed_at', { ascending: true })
      .limit(cfg.batchSize);

    if (cfg.tenantId) {
      query = query.eq('tenant_id', cfg.tenantId);
    }

    const { data: agreements, error: fetchError } = await query;

    if (fetchError) {
      console.error('Batch notarization fetch error:', fetchError);
      return result;
    }

    if (!agreements || agreements.length === 0) {
      return result;
    }

    for (const agreement of agreements) {
      result.processed++;

      try {
        // Check if already has a proof
        const { data: existingProof } = await supabase
          .from('blockchain_hash_registry')
          .select('id')
          .eq('signed_document_id', agreement.id)
          .eq('tenant_id', agreement.tenant_id)
          .maybeSingle();

        if (existingProof) {
          result.alreadyAnchored++;
          result.details.push({
            signedDocumentId: agreement.id,
            status: 'already_anchored',
          });
          continue;
        }

        // Check if already in queue
        const { data: existingQueue } = await supabase
          .from('blockchain_anchor_queue')
          .select('id')
          .eq('signed_document_id', agreement.id)
          .eq('tenant_id', agreement.tenant_id)
          .in('status', ['queued', 'processing'])
          .maybeSingle();

        if (existingQueue) {
          result.alreadyAnchored++;
          result.details.push({
            signedDocumentId: agreement.id,
            status: 'already_anchored',
          });
          continue;
        }

        // Enqueue for anchoring (hash only)
        const { error: insertError } = await supabase
          .from('blockchain_anchor_queue')
          .insert({
            tenant_id: agreement.tenant_id,
            signed_document_id: agreement.id,
            hash_sha256: agreement.signed_document_hash!,
          });

        if (insertError) {
          result.errors++;
          result.details.push({
            signedDocumentId: agreement.id,
            status: 'error',
            error: insertError.message,
          });
        } else {
          result.enqueued++;
          result.details.push({
            signedDocumentId: agreement.id,
            status: 'enqueued',
          });
        }
      } catch (err) {
        result.errors++;
        result.details.push({
          signedDocumentId: agreement.id,
          status: 'error',
          error: String(err),
        });
      }
    }
  } catch (err) {
    console.error('Batch notarization error:', err);
  }

  return result;
}

/**
 * Get batch notarization statistics for monitoring.
 */
export async function getBatchStats(tenantId: string): Promise<{
  totalSigned: number;
  anchored: number;
  pending: number;
  coverage: number;
}> {
  const { count: totalSigned } = await supabase
    .from('employee_agreements')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'signed')
    .not('signed_document_hash', 'is', null);

  const { count: anchored } = await supabase
    .from('blockchain_hash_registry')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed');

  const total = totalSigned ?? 0;
  const confirmed = anchored ?? 0;
  const pending = Math.max(0, total - confirmed);
  const coverage = total > 0 ? (confirmed / total) * 100 : 100;

  return { totalSigned: total, anchored: confirmed, pending, coverage };
}
