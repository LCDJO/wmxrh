/**
 * eSocial Transmission Controller
 *
 * Manages the lifecycle of eSocial events:
 *   draft → validated → queued → transmitting → accepted/rejected
 *
 * Pure logic — no I/O. Persistence is handled by the service layer.
 * The actual government API call is a Port (adapter pattern).
 */

import type {
  ESocialEnvelope,
  TransmissionStatus,
  TransmissionResult,
  ValidationResult,
} from './types';
import { getMapper } from './layout-mappers';

// ════════════════════════════════════
// VALIDATION
// ════════════════════════════════════

/**
 * Validate an envelope's payload against its layout mapper.
 * Returns the validation result without mutating the envelope.
 */
export function validateEnvelope(envelope: ESocialEnvelope): ValidationResult {
  const mapper = getMapper(envelope.event_type);
  if (!mapper) {
    return {
      valid: false,
      errors: [{ field: 'event_type', message: `Mapper não encontrado para ${envelope.event_type}`, code: 'NO_MAPPER' }],
    };
  }
  return mapper.validate(envelope.payload);
}

// ════════════════════════════════════
// STATE TRANSITIONS
// ════════════════════════════════════

const VALID_TRANSITIONS: Record<TransmissionStatus, TransmissionStatus[]> = {
  draft: ['validated', 'cancelled'],
  validated: ['queued', 'cancelled'],
  queued: ['transmitting', 'cancelled'],
  transmitting: ['accepted', 'rejected', 'error'],
  accepted: [], // Terminal
  rejected: ['draft'], // Can be corrected and resubmitted
  error: ['queued', 'cancelled'], // Retry or cancel
  cancelled: [], // Terminal
};

/**
 * Check if a status transition is allowed.
 */
export function canTransition(from: TransmissionStatus, to: TransmissionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Apply a status transition to an envelope (pure — returns new object).
 */
export function transitionEnvelope(
  envelope: ESocialEnvelope,
  newStatus: TransmissionStatus,
  meta?: Partial<Pick<ESocialEnvelope, 'receipt_number' | 'error_message' | 'error_code' | 'response_payload'>>,
): ESocialEnvelope {
  if (!canTransition(envelope.status, newStatus)) {
    throw new Error(`Transição inválida: ${envelope.status} → ${newStatus} para evento ${envelope.event_type}`);
  }

  const now = new Date().toISOString();
  const updates: Partial<ESocialEnvelope> = { status: newStatus };

  switch (newStatus) {
    case 'validated':
      updates.validated_at = now;
      break;
    case 'queued':
      updates.queued_at = now;
      break;
    case 'transmitting':
      updates.transmitted_at = now;
      break;
    case 'accepted':
      updates.accepted_at = now;
      updates.receipt_number = meta?.receipt_number ?? null;
      updates.response_payload = meta?.response_payload ?? null;
      break;
    case 'rejected':
    case 'error':
      updates.error_message = meta?.error_message ?? null;
      updates.error_code = meta?.error_code ?? null;
      updates.response_payload = meta?.response_payload ?? null;
      updates.retry_count = envelope.retry_count + 1;
      break;
  }

  return { ...envelope, ...updates };
}

// ════════════════════════════════════
// BATCH OPERATIONS
// ════════════════════════════════════

/**
 * Process a transmission result from the government API adapter.
 */
export function applyTransmissionResult(
  envelope: ESocialEnvelope,
  result: TransmissionResult,
): ESocialEnvelope {
  if (result.success) {
    return transitionEnvelope(envelope, 'accepted', {
      receipt_number: result.receipt_number,
      response_payload: result.government_response,
    });
  }
  return transitionEnvelope(envelope, 'rejected', {
    error_message: result.error_message,
    error_code: result.error_code,
    response_payload: result.government_response,
  });
}

/**
 * Get envelopes ready for transmission from a batch.
 */
export function getTransmittableEnvelopes(envelopes: ESocialEnvelope[]): ESocialEnvelope[] {
  return envelopes.filter(e => e.status === 'queued');
}

/**
 * Get summary stats from a batch of envelopes.
 */
export function computeBatchStats(envelopes: ESocialEnvelope[]) {
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const e of envelopes) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  return {
    total: envelopes.length,
    by_status: byStatus,
    by_category: byCategory,
    pending: (byStatus['draft'] || 0) + (byStatus['validated'] || 0) + (byStatus['queued'] || 0),
    errors: (byStatus['error'] || 0) + (byStatus['rejected'] || 0),
    accepted: byStatus['accepted'] || 0,
  };
}
