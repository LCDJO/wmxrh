/**
 * eSocial Return Processor
 *
 * Parses government responses after transmission, extracting:
 *   - protocolo (receipt/protocol number)
 *   - código erro (error code)
 *   - mensagem (error/warning message)
 *
 * Updates eSocialTransmissionLog entries with processed results.
 *
 * Pure logic — no I/O. Transforms government responses into domain state changes.
 */

import type { ESocialEnvelope, TransmissionStatus, TransmissionResult } from './types';
import { supabase } from '@/integrations/supabase/client';

// ════════════════════════════════════
// GOVERNMENT RESPONSE TYPES
// ════════════════════════════════════

export interface GovernmentResponse {
  status: 'accepted' | 'rejected' | 'partial' | 'error' | 'pending';
  /** Protocolo de recibo do governo */
  receipt_number: string | null;
  /** Protocolo de envio */
  protocol: string | null;
  processed_at: string;
  events: GovernmentEventResponse[];
}

export interface GovernmentEventResponse {
  event_id: string;
  status: 'accepted' | 'rejected' | 'warning';
  receipt_number?: string;
  /** Código de erro do governo (e.g. "201", "402.1") */
  error_code?: string;
  /** Mensagem descritiva do erro */
  error_message?: string;
  warning_message?: string;
}

// ════════════════════════════════════
// PROCESSED RETURN
// ════════════════════════════════════

export interface ProcessedReturn {
  envelope_id: string;
  new_status: TransmissionStatus;
  /** Protocolo de recibo */
  receipt_number: string | null;
  /** Protocolo de envio */
  protocol: string | null;
  /** Lista de mensagens de erro */
  errors: string[];
  warnings: string[];
  /** Lista de códigos de erro */
  error_codes: string[];
  requires_correction: boolean;
  can_retry: boolean;
  processed_at: string;
}

// ════════════════════════════════════
// ESOCIAL TRANSMISSION LOG (persistence model)
// ════════════════════════════════════

export interface ESocialTransmissionLog {
  id: string;
  envelope_id: string;
  tenant_id: string;
  event_type: string;
  /** Status final após processamento */
  status: TransmissionStatus;
  /** Protocolo de recibo do governo */
  protocolo: string | null;
  /** Código do erro (primeiro da lista) */
  codigo_erro: string | null;
  /** Mensagem descritiva do erro */
  mensagem: string | null;
  /** Todos os códigos de erro recebidos */
  error_codes: string[];
  /** Avisos do governo */
  warnings: string[];
  /** Indica se precisa correção manual */
  requires_correction: boolean;
  /** Indica se pode retentar automaticamente */
  can_retry: boolean;
  /** Tentativa atual */
  attempt: number;
  /** Resposta bruta do governo */
  raw_response: Record<string, unknown> | null;
  transmitted_at: string;
  processed_at: string;
}

// ════════════════════════════════════
// ERROR CODE CLASSIFICATION
// ════════════════════════════════════

const RETRIABLE_ERROR_PREFIXES = ['SIM_', 'TIMEOUT', 'NET_', '999'];
const CORRECTION_REQUIRED_PREFIXES = ['100', '200', '300', '400', '500'];

function classifyError(errorCode: string): { retriable: boolean; requiresCorrection: boolean } {
  const retriable = RETRIABLE_ERROR_PREFIXES.some(p => errorCode.startsWith(p));
  const requiresCorrection = CORRECTION_REQUIRED_PREFIXES.some(p => errorCode.startsWith(p));
  return { retriable, requiresCorrection: !retriable && requiresCorrection };
}

// ════════════════════════════════════
// CORE: Process Return
// ════════════════════════════════════

/**
 * Process a government response for a single envelope.
 * Returns protocolo, código erro, mensagem.
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

  let newStatus: TransmissionStatus;
  switch (response.status) {
    case 'accepted':
      newStatus = 'accepted';
      break;
    case 'rejected':
      newStatus = 'rejected';
      break;
    case 'partial':
      newStatus = 'rejected';
      warnings.push('Lote parcialmente aceito — revisar eventos individuais');
      break;
    case 'error':
      newStatus = 'error';
      canRetry = true;
      break;
    case 'pending':
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

// ════════════════════════════════════
// BATCH PROCESSING
// ════════════════════════════════════

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

// ════════════════════════════════════
// BUILD TRANSMISSION LOG
// ════════════════════════════════════

/**
 * Convert ProcessedReturn → ESocialTransmissionLog entry.
 */
export function buildTransmissionLog(
  processed: ProcessedReturn,
  envelope: ESocialEnvelope,
  attempt: number,
  rawResponse?: Record<string, unknown>,
): ESocialTransmissionLog {
  return {
    id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    envelope_id: processed.envelope_id,
    tenant_id: envelope.tenant_id,
    event_type: envelope.event_type,
    status: processed.new_status,
    protocolo: processed.protocol ?? processed.receipt_number,
    codigo_erro: processed.error_codes[0] ?? null,
    mensagem: processed.errors[0] ?? null,
    error_codes: processed.error_codes,
    warnings: processed.warnings,
    requires_correction: processed.requires_correction,
    can_retry: processed.can_retry,
    attempt,
    raw_response: rawResponse ?? null,
    transmitted_at: envelope.transmitted_at ?? new Date().toISOString(),
    processed_at: processed.processed_at,
  };
}

// ════════════════════════════════════
// PERSIST: Update esocial_events table
// ════════════════════════════════════

/**
 * Persist the processed return into the esocial_events table,
 * updating status, receipt, error info, and response payload.
 */
export async function updateTransmissionLog(
  processed: ProcessedReturn,
  rawResponse?: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const responsePayload = rawResponse
    ? JSON.parse(JSON.stringify(rawResponse))
    : JSON.parse(JSON.stringify({
        protocolo: processed.protocol,
        codigo_erro: processed.error_codes,
        mensagem: processed.errors,
        warnings: processed.warnings,
        requires_correction: processed.requires_correction,
        can_retry: processed.can_retry,
      }));

  const mappedStatus = (['accepted', 'rejected', 'error', 'pending', 'sent', 'processing', 'cancelled'] as const)
    .find(s => s === processed.new_status) ?? 'pending';

  const { error } = await supabase
    .from('esocial_events')
    .update({
      status: mappedStatus,
      receipt_number: processed.receipt_number,
      error_message: processed.errors.length > 0
        ? `[${processed.error_codes[0] ?? 'ERR'}] ${processed.errors[0]}`
        : null,
      response_payload: responsePayload,
      processed_at: processed.processed_at,
    })
    .eq('id', processed.envelope_id);

  if (error) {
    console.error('[ReturnProcessor] Falha ao atualizar esocial_events:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Persist a batch of processed returns.
 */
export async function updateBatchTransmissionLogs(
  returns: ProcessedReturn[],
  rawResponses?: Map<string, Record<string, unknown>>,
): Promise<{ total: number; succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (const ret of returns) {
    const raw = rawResponses?.get(ret.envelope_id);
    const result = await updateTransmissionLog(ret, raw);
    if (result.success) succeeded++;
    else failed++;
  }

  return { total: returns.length, succeeded, failed };
}

// ════════════════════════════════════
// BRIDGE: to TransmissionResult
// ════════════════════════════════════

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

// ════════════════════════════════════
// SUMMARY
// ════════════════════════════════════

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
