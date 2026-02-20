/**
 * External Legal API Service — Stub
 *
 * Future integration with external legal data providers
 * (LexML, Planalto, MTE API, eSocial API).
 *
 * This is a contract-first stub. Actual implementation will
 * call edge functions that proxy to external APIs.
 */

import type {
  LegalApiConfig,
  LegalApiQueryParams,
  LegalApiResponse,
  LegalApiSyncResult,
  LegalApiProvider,
} from './types';

/** Validate API config before use */
export function validateLegalApiConfig(config: LegalApiConfig): string[] {
  const errors: string[] = [];
  if (!config.base_url) errors.push('base_url is required');
  if (!config.api_key_ref) errors.push('api_key_ref is required');
  if (config.rate_limit_rpm < 1) errors.push('rate_limit_rpm must be >= 1');
  if (config.timeout_ms < 1000) errors.push('timeout_ms must be >= 1000');
  return errors;
}

/** Build query string from params (for future HTTP calls) */
export function buildQueryString(params: LegalApiQueryParams): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/** Parse API response into normalized format */
export function parseApiResponse(raw: unknown): LegalApiResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      data: [],
      total: 0,
      pagina: 0,
      total_paginas: 0,
      error: 'Invalid response format',
      api_latency_ms: 0,
    };
  }
  // Future: parse provider-specific formats
  return raw as LegalApiResponse;
}

/**
 * Stub: Sync norms from an external legal API.
 * Will be implemented via edge function when API credentials are configured.
 */
export async function syncFromLegalApi(
  _config: LegalApiConfig,
  _params: LegalApiQueryParams,
): Promise<LegalApiSyncResult> {
  console.warn('[LegalApiService] syncFromLegalApi is a stub — not yet implemented');
  return {
    provider: _config.provider,
    normas_encontradas: 0,
    normas_novas: 0,
    normas_atualizadas: 0,
    erros: ['Integration not yet implemented'],
    synced_at: new Date().toISOString(),
  };
}

/** Get default config for a known provider */
export function getDefaultProviderConfig(provider: LegalApiProvider): Partial<LegalApiConfig> {
  const defaults: Record<LegalApiProvider, Partial<LegalApiConfig>> = {
    lexml: {
      base_url: 'https://www.lexml.gov.br/api/v1',
      rate_limit_rpm: 30,
      timeout_ms: 10000,
      retry_attempts: 3,
    },
    planalto: {
      base_url: 'https://www.planalto.gov.br/api',
      rate_limit_rpm: 20,
      timeout_ms: 15000,
      retry_attempts: 2,
    },
    mte_api: {
      base_url: 'https://api.mte.gov.br/v1',
      rate_limit_rpm: 60,
      timeout_ms: 10000,
      retry_attempts: 3,
    },
    esocial_api: {
      base_url: 'https://api.esocial.gov.br/v1',
      rate_limit_rpm: 30,
      timeout_ms: 20000,
      retry_attempts: 3,
    },
    custom: {
      rate_limit_rpm: 10,
      timeout_ms: 10000,
      retry_attempts: 2,
    },
  };
  return defaults[provider] ?? defaults.custom;
}
