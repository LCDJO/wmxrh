/**
 * Legal Source Adapters — Public API
 *
 * Unified access to all 6 legal data sources:
 *  - NR (Normas Regulamentadoras — MTE)
 *  - CLT (Consolidação das Leis do Trabalho)
 *  - eSocial (Layout de Eventos)
 *  - CNAE (Classificação Nacional de Atividades Econômicas)
 *  - CBO (Classificação Brasileira de Ocupações)
 *  - CCT (Convenções Coletivas — futuro)
 */

// ── Adapters ──
export { createNrAdapter } from './nr-adapter';
export { createCltAdapter } from './clt-adapter';
export { createEsocialAdapter } from './esocial-adapter';
export { createCnaeAdapter } from './cnae-adapter';
export { createCboAdapter } from './cbo-adapter';
export { createCctAdapter } from './cct-adapter';

// ── Types ──
export type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck, SyncOptions, SyncResult, LegalSourceId } from './types';
export type { NrRecord } from './nr-adapter';
export type { CltArticle, CltTema } from './clt-adapter';
export type { EsocialEvent, EsocialEventGroup } from './esocial-adapter';
export type { CnaeRecord } from './cnae-adapter';
export type { CboRecord } from './cbo-adapter';
export type { CctRecord, CctClausulaDestaque } from './cct-adapter';

// ── Registry (convenience) ──
import type { LegalSourceAdapter } from './types';
import { createNrAdapter } from './nr-adapter';
import { createCltAdapter } from './clt-adapter';
import { createEsocialAdapter } from './esocial-adapter';
import { createCnaeAdapter } from './cnae-adapter';
import { createCboAdapter } from './cbo-adapter';
import { createCctAdapter } from './cct-adapter';

/** Returns all legal source adapters keyed by source ID */
export function createAllAdapters(): Record<string, LegalSourceAdapter> {
  return {
    nr: createNrAdapter(),
    clt: createCltAdapter(),
    esocial: createEsocialAdapter(),
    cnae: createCnaeAdapter(),
    cbo: createCboAdapter(),
    cct: createCctAdapter(),
  };
}
