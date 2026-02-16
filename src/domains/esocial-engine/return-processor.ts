/**
 * eSocial Return Processor
 *
 * Parses government responses after transmission, extracting:
 *   - Receipt numbers (protocolos)
 *   - Acceptance confirmations
 *   - Rejection details (error codes + messages)
 *   - Partial batch results
 *
 * Pure logic — no I/O. Transforms government responses into domain state changes.
 */

import type { ESocialEnvelope, TransmissionStatus, TransmissionResult } from './types';

// ════════════════════════════════════
// GOVERNMENT RESPONSE TYPES
// ════════════════════════════════════

export interface GovernmentResponse {
  status: 'accepted' | 'rejected' | 'partial' | 'error' | 'pending';
  receipt_number: string | null;
  protocol: string | null;
  processed_at: string;
  events: GovernmentEventResponse[];
}

export interface GovernmentEventResponse {
  event_id: string;
  status: 'accepted' | 'rejected' | 'warning';
  receipt_number?: string;
  error_code?: string;
  error_message?: string;
  warning_message?: string;
}

// ════════════════════════════════════
// PROCESSED RETURN
// ════════════════════════════════════

export interface ProcessedReturn {
  envelope_id: string;
  new_status: TransmissionStatus;
  receipt_number: string | null;
  protocol: string | null;
  errors: string[];
  warnings: string[];
  error_codes: string[];
  requires_correction: boolean;
  can_retry: boolean;
  processed_at: string;
}

// ════════════════════════════════════
// ESOCIAL ERROR CODE CLASSIFICATION
// ════════════════════════════════════

const RETRIABLE_ERROR_PREFIXES = ['SIM_', 'TIMEOUT', 'NET_', '999'];
const CORRECTION_REQUIRED_PREFIXES = ['100', '200', '300', '400', '500'];

function classifyError(errorCode: string): { retriable: boolean; requiresCorrection: boolean } {
  const retriable = RETRIABLE_ERROR_PREFIXES.some(p => errorCode.startsWith(p));
  const requiresCorrection = CORRECTION_REQUIRED_PREFIXES.some(p => errorCode.startsWith(p));
  return { retriable, requiresCorrection: !retriable && requiresCorrection };
}

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

/**
 * Process a government response for a single envelope.
 */
export function processReturn(
  envelope: ESocialEnvelope,
  response: GovernmentResponse,
): ProcessedReturn {
  const errors: string[] = [];
  const warnings: string[] = [];
  const errorCodes: string[] = [];
  let requiresCorrection = false;
  let canRetry = false;

  // Collect errors and warnings from event responses
  for (const evt of response.events) {
    if (evt.error_message) errors.push(evt.error_message);
    if (evt.warning_message) warnings.push(evt.warning_message);
    if (evt.error_code) {
      errorCodes.push(evt.error_code);
      const classification = classifyError(evt.error_code);
      if (classification.retriable) canRetry = true;
      if (classification.requiresCorrection) requiresCorrection = true;
    }
  }

  // Determine new status
  let newStatus: TransmissionStatus;
  switch (response.status) {
    case 'accepted':
      newStatus = 'accepted';
      break;
    case 'rejected':
      newStatus = 'rejected';
      break;
    case 'partial':
      // Partial = some accepted, some rejected → mark as rejected for re-review
      newStatus = 'rejected';
      warnings.push('Lote parcialmente aceito — revisar eventos individuais');
      break;
    case 'error':
      newStatus = 'error';
      canRetry = true;
      break;
    case 'pending':
      // Still processing — don't change status yet
      newStatus = envelope.status;
      break;
    default:
      newStatus = 'error';
  }

  return {
    envelope_id: envelope.id,
    new_status: newStatus,
    receipt_number: response.receipt_number,
    protocol: response.protocol,
    errors,
    warnings,
    error_codes: errorCodes,
    requires_correction: requiresCorrection,
    can_retry: canRetry,
    processed_at: response.processed_at,
  };
}

/**
 * Process a batch of government responses.
 */
export function processBatchReturn(
  envelopes: ESocialEnvelope[],
  responses: Map<string, GovernmentResponse>,
): ProcessedReturn[] {
  return envelopes.map(env => {
    const response = responses.get(env.id);
    if (!response) {
      return {
        envelope_id: env.id,
        new_status: 'error' as TransmissionStatus,
        receipt_number: null,
        protocol: null,
        errors: ['Resposta do governo não encontrada para este evento'],
        warnings: [],
        error_codes: ['NO_RESPONSE'],
        requires_correction: false,
        can_retry: true,
        processed_at: new Date().toISOString(),
      };
    }
    return processReturn(env, response);
  });
}

/**
 * Convert a ProcessedReturn to a TransmissionResult (bridge to existing code).
 */
export function toTransmissionResult(processed: ProcessedReturn): TransmissionResult {
  return {
    envelope_id: processed.envelope_id,
    success: processed.new_status === 'accepted',
    receipt_number: processed.receipt_number ?? undefined,
    error_code: processed.error_codes[0],
    error_message: processed.errors[0],
    government_response: {
      protocol: processed.protocol,
      warnings: processed.warnings,
      error_codes: processed.error_codes,
    },
  };
}

/**
 * Summarize batch processing results.
 */
export function summarizeBatchReturn(returns: ProcessedReturn[]): {
  total: number;
  accepted: number;
  rejected: number;
  errors: number;
  pending: number;
  requires_correction: number;
  can_retry: number;
} {
  return {
    total: returns.length,
    accepted: returns.filter(r => r.new_status === 'accepted').length,
    rejected: returns.filter(r => r.new_status === 'rejected').length,
    errors: returns.filter(r => r.new_status === 'error').length,
    pending: returns.filter(r => r.new_status === 'transmitting').length,
    requires_correction: returns.filter(r => r.requires_correction).length,
    can_retry: returns.filter(r => r.can_retry).length,
  };
}
