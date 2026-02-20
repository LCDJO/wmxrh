/**
 * Regulatory Event Consumer
 *
 * Subscribes to Regulatory Intelligence events and triggers
 * the Legal AI Interpretation pipeline automatically.
 *
 * Consumed events:
 *  - CHANGE_DETECTED  → full interpretation pipeline
 *  - NR_UPDATED       → NR-specific interpretation
 *  - CCT_UPDATED      → CCT-specific interpretation
 *  - LEGISLATION_UPDATED → CLT/Lei/Decreto interpretation
 *  - ESOCIAL_LAYOUT_CHANGED → eSocial impact analysis
 */

import { regulatoryEvents, onRegulatoryEvent } from '@/domains/regulatory-intelligence';
import { generateInterpretation } from './interpretation.engine';
import { emitLegalAiEvent, legalAiEvents } from './legal-ai-interpretation.events';
import type { InterpretationInput } from './types';

// ── Event → Area Mapping ──

const EVENT_AREA_MAP: Record<string, string[]> = {
  [regulatoryEvents.NR_UPDATED]: ['seguranca_trabalho', 'treinamentos', 'epi', 'saude_ocupacional'],
  [regulatoryEvents.CCT_UPDATED]: ['folha_pagamento', 'jornada', 'beneficios', 'sindical'],
  [regulatoryEvents.LEGISLATION_UPDATED]: ['folha_pagamento', 'jornada', 'admissao', 'demissao'],
  [regulatoryEvents.ESOCIAL_LAYOUT_CHANGED]: ['esocial', 'folha_pagamento'],
  [regulatoryEvents.CHANGE_DETECTED]: [],
};

// ── Payload Normalizer ──

function toInterpretationInput(
  event: string,
  payload: Record<string, unknown>,
): InterpretationInput {
  const areas = EVENT_AREA_MAP[event] || [];
  const payloadAreas = (payload.areas_impactadas as string[]) || [];
  const mergedAreas = Array.from(new Set([...areas, ...payloadAreas]));

  return {
    tenant_id: (payload.tenant_id as string) || '',
    norm_codigo: (payload.norm_codigo as string) || (payload.codigo as string) || '',
    norm_titulo: (payload.norm_titulo as string) || (payload.titulo as string) || '',
    orgao_emissor: (payload.orgao_emissor as string) || 'N/A',
    data_publicacao: (payload.data_publicacao as string) || new Date().toISOString(),
    data_vigencia: (payload.data_vigencia as string) || new Date().toISOString(),
    texto_alteracao: (payload.texto_alteracao as string) || (payload.resumo_alteracoes as string) || '',
    diff_summary: payload.diff_summary
      ? (payload.diff_summary as InterpretationInput['diff_summary'])
      : null,
    areas_impactadas: mergedAreas,
  };
}

// ── Handler ──

function handleRegulatoryEvent(event: string, payload: Record<string, unknown>): void {
  try {
    const input = toInterpretationInput(event, payload);

    if (!input.norm_codigo || !input.tenant_id) {
      console.warn(`[LegalAI Consumer] Skipping ${event}: missing norm_codigo or tenant_id`);
      return;
    }

    const result = generateInterpretation(input);

    if (result.success) {
      emitLegalAiEvent(legalAiEvents.INTERPRETATION_GENERATED, {
        event_source: event,
        tenant_id: input.tenant_id,
        norm_codigo: input.norm_codigo,
        summary: result.summary,
        interpretation: result.interpretation,
      });

      if (result.interpretation.confianca === 'requer_validacao_humana') {
        emitLegalAiEvent(legalAiEvents.HUMAN_REVIEW_REQUIRED, {
          tenant_id: input.tenant_id,
          norm_codigo: input.norm_codigo,
          reason: 'Low confidence — insufficient data for automatic interpretation',
        });
      }
    } else {
      console.error(`[LegalAI Consumer] Interpretation failed for ${input.norm_codigo}:`, result.errors);
    }
  } catch (err) {
    console.error(`[LegalAI Consumer] Error handling ${event}:`, err);
  }
}

// ── Subscription Manager ──

let unsubscribers: (() => void)[] = [];

export function startRegulatoryEventConsumer(): void {
  if (unsubscribers.length > 0) return; // already started

  const eventsToConsume = [
    regulatoryEvents.CHANGE_DETECTED,
    regulatoryEvents.NR_UPDATED,
    regulatoryEvents.CCT_UPDATED,
    regulatoryEvents.LEGISLATION_UPDATED,
    regulatoryEvents.ESOCIAL_LAYOUT_CHANGED,
  ];

  for (const event of eventsToConsume) {
    const unsub = onRegulatoryEvent(event, (payload) => {
      handleRegulatoryEvent(event, payload);
    });
    unsubscribers.push(unsub);
  }

  console.info('[LegalAI Consumer] Subscribed to', eventsToConsume.length, 'regulatory events');
}

export function stopRegulatoryEventConsumer(): void {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  console.info('[LegalAI Consumer] Unsubscribed from all regulatory events');
}
