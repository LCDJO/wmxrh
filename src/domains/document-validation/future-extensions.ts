/**
 * Document Validation — Future Extensions
 *
 * Extensibility stubs for planned capabilities:
 *   1. ICP-Brasil digital certificate signing
 *   2. Blockchain proof hash anchoring
 *   3. Public API for automated validation
 *   4. LGPD log export (CSV/JSON)
 *
 * Each module exposes a clear interface so integration is plug-and-play
 * when the external services become available.
 */

import { lgpdValidationLogService } from './lgpd-validation-log.service';

// ═══════════════════════════════════════════════════════════
// 1. ICP-Brasil — Digital Certificate Signing (stub)
// ═══════════════════════════════════════════════════════════

export interface ICPBrasilSignatureRequest {
  document_hash: string;
  signer_cpf: string;
  certificate_chain?: string;
}

export interface ICPBrasilSignatureResult {
  signed: boolean;
  signature_pkcs7?: string;
  certificate_cn?: string;
  timestamp_authority?: string;
  error?: string;
}

/**
 * Stub: Sign document hash with ICP-Brasil certificate.
 * Future integration: connect to a TSA (Time Stamp Authority)
 * and PKCS#7/CAdES signer service.
 */
export async function signWithICPBrasil(
  _req: ICPBrasilSignatureRequest
): Promise<ICPBrasilSignatureResult> {
  console.warn('[ICPBrasil] Stub — ICP-Brasil signing not yet configured.');
  return {
    signed: false,
    error: 'ICP-Brasil integration not configured. Contact platform admin.',
  };
}

/** Check if ICP-Brasil signing is available. */
export function isICPBrasilAvailable(): boolean {
  return false; // flip to true when provider is connected
}

// ═══════════════════════════════════════════════════════════
// 2. Blockchain Proof Hash Anchoring — NOW LIVE via blockchain-registry domain
// ═══════════════════════════════════════════════════════════

export type { BlockchainAnchorRequest, BlockchainAnchorResult };

interface BlockchainAnchorRequest {
  document_hash: string;
  tenant_id: string;
  metadata?: Record<string, unknown>;
}

interface BlockchainAnchorResult {
  anchored: boolean;
  tx_hash?: string;
  chain?: string;
  block_number?: number;
  timestamp?: string;
  error?: string;
}

/**
 * Anchor document hash via blockchain-registry domain service.
 */
export async function anchorOnBlockchain(
  req: BlockchainAnchorRequest & { signed_document_id?: string }
): Promise<BlockchainAnchorResult> {
  try {
    const { blockchainRegistryService } = await import('@/domains/blockchain-registry');
    const result = await blockchainRegistryService.anchor({
      tenant_id: req.tenant_id,
      signed_document_id: req.signed_document_id || '',
      hash_sha256: req.document_hash,
    });
    if (result.success && result.record) {
      return {
        anchored: true,
        tx_hash: result.record.transaction_hash ?? undefined,
        chain: result.record.blockchain_network,
        block_number: result.record.block_number ?? undefined,
        timestamp: result.record.timestamp_blockchain,
      };
    }
    return { anchored: false, error: result.error };
  } catch (err) {
    return { anchored: false, error: String(err) };
  }
}

/** Blockchain anchoring is now available. */
export function isBlockchainAvailable(): boolean {
  return true;
}

// ═══════════════════════════════════════════════════════════
// 3. Public Validation API (already live via edge function)
// ═══════════════════════════════════════════════════════════

/**
 * Construct the public API URL for automated validation.
 * This is already functional via the validate-document edge function.
 */
export function getPublicApiUrl(token: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/validate-document?token=${token}`;
}

/**
 * API documentation stub for future OpenAPI/Swagger generation.
 */
export const PUBLIC_API_SPEC = {
  endpoint: '/functions/v1/validate-document',
  methods: ['GET', 'POST'],
  description: 'Public document validation endpoint with LGPD compliance.',
  get_params: { token: 'string (UUID v4) — validation token' },
  post_body: {
    token: 'string (UUID v4)',
    requester_name: 'string (required)',
    requester_email: 'string (required, valid email)',
    requester_purpose: 'string (required)',
    privacy_accepted: 'boolean (must be true)',
  },
  responses: {
    200: 'Document is valid — returns document_name, signed_at, document_hash, versao, signer_name',
    400: 'Invalid token or validation failed',
    404: 'Token not found',
    422: 'Missing LGPD fields',
    429: 'Rate limited — retry after N seconds',
  },
  rate_limits: {
    per_ip: '20 requests/minute',
    lockout: '5 failed attempts → 15min block',
  },
} as const;

// ═══════════════════════════════════════════════════════════
// 4. LGPD Log Export (CSV / JSON)
// ═══════════════════════════════════════════════════════════

function escapeCSV(val: string | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Export LGPD validation logs as CSV string.
 */
export async function exportLGPDLogsCSV(tenantId: string): Promise<string> {
  const logs = await lgpdValidationLogService.list(tenantId, 10000);

  const header = [
    'ID',
    'Token ID',
    'Signed Document ID',
    'Nome',
    'Email',
    'Finalidade',
    'IP',
    'User Agent',
    'Resultado',
    'Aceite Privacidade',
    'Data/Hora',
  ].join(',');

  const rows = logs.map((l) =>
    [
      escapeCSV(l.id),
      escapeCSV(l.token_id),
      escapeCSV(l.signed_document_id),
      escapeCSV(l.nome),
      escapeCSV(l.email),
      escapeCSV(l.finalidade),
      escapeCSV(l.ip),
      escapeCSV(l.user_agent),
      escapeCSV(l.access_result),
      l.privacy_accepted ? 'Sim' : 'Não',
      escapeCSV(l.timestamp),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Export LGPD validation logs as JSON string.
 */
export async function exportLGPDLogsJSON(tenantId: string): Promise<string> {
  const logs = await lgpdValidationLogService.list(tenantId, 10000);
  return JSON.stringify(logs, null, 2);
}

/**
 * Trigger browser download of LGPD logs.
 */
export async function downloadLGPDLogs(
  tenantId: string,
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  const content =
    format === 'csv'
      ? await exportLGPDLogsCSV(tenantId)
      : await exportLGPDLogsJSON(tenantId);

  const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json';
  const ext = format;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `lgpd-validation-logs-${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
