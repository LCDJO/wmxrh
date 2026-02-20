/**
 * DOU Real-Time Monitor Service — Stub
 *
 * Monitors the Diário Oficial da União for relevant publications.
 * Will use cron-triggered edge functions for periodic checks.
 */

import type {
  DouMonitorConfig,
  DouPublicacao,
  DouCheckResult,
  DouDigestResult,
  DouSecao,
} from './types';

/** Default monitor config for a new tenant */
export function createDefaultDouConfig(tenant_id: string): DouMonitorConfig {
  return {
    tenant_id,
    secoes_monitoradas: ['secao1', 'secao2'],
    palavras_chave: ['NR', 'SST', 'eSocial', 'CLT', 'trabalho', 'saúde ocupacional'],
    orgaos_filtro: ['Ministério do Trabalho e Emprego'],
    tipos_ato_filtro: ['Portaria', 'Instrução Normativa', 'Resolução', 'Decreto'],
    frequencia_verificacao_minutos: 60,
    webhook_url: null,
    notificar_imediato: true,
    status: 'desativado',
    ultimo_item_processado_id: null,
    ultima_verificacao: null,
  };
}

/** Calculate relevance score for a publication against keywords */
export function calculateRelevanceScore(
  publicacao: Pick<DouPublicacao, 'titulo' | 'ementa' | 'orgao'>,
  palavras_chave: string[],
  orgaos_filtro: string[],
): number {
  let score = 0;
  const searchText = `${publicacao.titulo} ${publicacao.ementa} ${publicacao.orgao}`.toLowerCase();

  for (const keyword of palavras_chave) {
    const regex = new RegExp(keyword.toLowerCase(), 'g');
    const matches = searchText.match(regex);
    if (matches) score += matches.length * 10;
  }

  if (orgaos_filtro.some(o => publicacao.orgao.toLowerCase().includes(o.toLowerCase()))) {
    score += 30;
  }

  return Math.min(score, 100);
}

/** Filter publications by config */
export function filterPublicacoes(
  publicacoes: DouPublicacao[],
  config: DouMonitorConfig,
): DouPublicacao[] {
  return publicacoes.filter(pub => {
    if (!config.secoes_monitoradas.includes(pub.secao)) return false;
    if (config.tipos_ato_filtro.length > 0 && !config.tipos_ato_filtro.includes(pub.tipo_ato)) return false;
    return pub.relevancia_score > 0;
  });
}

/**
 * Stub: Check DOU for new publications.
 * Will be implemented via cron-triggered edge function.
 */
export async function checkDou(
  _config: DouMonitorConfig,
): Promise<DouCheckResult> {
  console.warn('[DouMonitor] checkDou is a stub — not yet implemented');
  return {
    success: false,
    novas_publicacoes: 0,
    publicacoes: [],
    alertas_gerados: 0,
    error: 'DOU monitoring not yet implemented',
    checked_at: new Date().toISOString(),
    next_check_at: new Date(Date.now() + _config.frequencia_verificacao_minutos * 60_000).toISOString(),
  };
}

/**
 * Stub: Generate daily DOU digest.
 */
export async function generateDouDigest(
  _config: DouMonitorConfig,
  _data: string,
): Promise<DouDigestResult> {
  console.warn('[DouMonitor] generateDouDigest is a stub — not yet implemented');
  return {
    data_referencia: _data,
    total_publicacoes: 0,
    publicacoes_relevantes: 0,
    publicacoes: [],
    palavras_chave_match: {},
    generated_at: new Date().toISOString(),
  };
}
