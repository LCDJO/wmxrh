/**
 * AI Impact Summarization Service — Stub
 *
 * Uses Lovable AI (via edge function) to generate executive summaries
 * of regulatory changes and their impacts.
 *
 * Contract-first: types defined, implementation via edge function.
 */

import type {
  AiSummarizationRequest,
  AiSummarizationResult,
  SummaryFormat,
} from './types';

/** Build system prompt based on summary format */
export function buildSummarizationPrompt(formato: SummaryFormat): string {
  const prompts: Record<SummaryFormat, string> = {
    executivo: `Você é um especialista em legislação trabalhista brasileira. Gere um resumo executivo conciso da alteração regulatória, focando em impactos financeiros e prazos. Responda em português brasileiro.`,
    tecnico: `Você é um analista jurídico-trabalhista. Gere uma análise técnica detalhada da alteração, incluindo artigos afetados, obrigações e riscos de não conformidade. Responda em português brasileiro.`,
    compliance: `Você é um auditor de compliance trabalhista. Analise a alteração sob a ótica de conformidade regulatória, identifique gaps e ações corretivas necessárias. Responda em português brasileiro.`,
    rh: `Você é um consultor de RH. Explique de forma clara e prática o impacto da alteração para a equipe de recursos humanos, incluindo ações imediatas necessárias. Responda em português brasileiro.`,
  };
  return prompts[formato];
}

/** Build user prompt from request data */
export function buildUserPrompt(request: AiSummarizationRequest): string {
  const areas = request.areas_impactadas.join(', ');
  const entidades = request.entidades_afetadas
    .map(e => `${e.type}: ${e.name}`)
    .join('; ');

  return [
    `## Alteração Regulatória`,
    `**Norma:** ${request.norm_codigo} — ${request.norm_titulo}`,
    `**Áreas impactadas:** ${areas}`,
    `**Entidades afetadas:** ${entidades}`,
    ``,
    `## Texto da alteração`,
    request.texto_alteracao,
    ``,
    `Gere: resumo executivo, pontos-chave, ações recomendadas, prazo estimado, nível de risco, impacto financeiro estimado e departamentos afetados.`,
  ].join('\n');
}

/**
 * Stub: Summarize regulatory impact using AI.
 * Will be implemented via edge function calling Lovable AI Gateway.
 */
export async function summarizeImpact(
  _request: AiSummarizationRequest,
): Promise<AiSummarizationResult> {
  console.warn('[AiSummarization] summarizeImpact is a stub — not yet implemented');
  return {
    resumo_executivo: 'Stub: implementação via edge function pendente.',
    pontos_chave: [],
    acoes_recomendadas: [],
    prazo_estimado: null,
    risco_nao_conformidade: 'medio',
    impacto_financeiro_estimado: null,
    areas_departamento_afetadas: [],
    modelo_utilizado: _request.modelo ?? 'gemini-flash',
    tokens_consumidos: 0,
    generated_at: new Date().toISOString(),
  };
}
