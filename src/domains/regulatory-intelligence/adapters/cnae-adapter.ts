/**
 * CNAE Adapter — Classificação Nacional de Atividades Econômicas
 *
 * Structured access to CNAE codes with risk grade mapping,
 * applicable NRs, and eSocial requirements.
 *
 * Source: IBGE / Receita Federal
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface CnaeRecord {
  codigo: string;
  descricao: string;
  secao: string;
  divisao: string;
  grupo: string;
  classe: string;
  subclasse: string | null;
  grau_risco: number;
  nrs_aplicaveis: number[];
  exige_sesmt: boolean;
  exige_cipa: boolean;
  exige_pcmso: boolean;
  exige_pgr: boolean;
  atividade_insalubre: boolean;
  atividade_perigosa: boolean;
  aliquota_rat: number;
  fap_referencia: number;
}

const CNAE_CATALOG: CnaeRecord[] = [
  { codigo: '6201-5/01', descricao: 'Desenvolvimento de programas de computador sob encomenda', secao: 'J', divisao: '62', grupo: '620', classe: '6201-5', subclasse: '01', grau_risco: 1, nrs_aplicaveis: [1, 5, 7, 17], exige_sesmt: false, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: false, atividade_perigosa: false, aliquota_rat: 1.0, fap_referencia: 1.0 },
  { codigo: '6202-3/00', descricao: 'Desenvolvimento e licenciamento de programas customizáveis', secao: 'J', divisao: '62', grupo: '620', classe: '6202-3', subclasse: '00', grau_risco: 1, nrs_aplicaveis: [1, 5, 7, 17], exige_sesmt: false, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: false, atividade_perigosa: false, aliquota_rat: 1.0, fap_referencia: 1.0 },
  { codigo: '4120-4/00', descricao: 'Construção de edifícios', secao: 'F', divisao: '41', grupo: '412', classe: '4120-4', subclasse: '00', grau_risco: 4, nrs_aplicaveis: [1, 4, 5, 6, 7, 9, 12, 15, 17, 18, 33, 35], exige_sesmt: true, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: true, atividade_perigosa: true, aliquota_rat: 3.0, fap_referencia: 1.5 },
  { codigo: '8610-1/01', descricao: 'Atividades de atendimento hospitalar', secao: 'Q', divisao: '86', grupo: '861', classe: '8610-1', subclasse: '01', grau_risco: 3, nrs_aplicaveis: [1, 4, 5, 6, 7, 9, 15, 32], exige_sesmt: true, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: true, atividade_perigosa: false, aliquota_rat: 2.0, fap_referencia: 1.2 },
  { codigo: '4711-3/01', descricao: 'Comércio varejista de mercadorias em geral (hipermercados)', secao: 'G', divisao: '47', grupo: '471', classe: '4711-3', subclasse: '01', grau_risco: 2, nrs_aplicaveis: [1, 5, 6, 7, 12, 17], exige_sesmt: false, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: false, atividade_perigosa: false, aliquota_rat: 2.0, fap_referencia: 1.0 },
  { codigo: '0710-3/01', descricao: 'Extração de minério de ferro', secao: 'B', divisao: '07', grupo: '071', classe: '0710-3', subclasse: '01', grau_risco: 4, nrs_aplicaveis: [1, 4, 5, 6, 7, 9, 12, 15, 22, 33], exige_sesmt: true, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: true, atividade_perigosa: true, aliquota_rat: 3.0, fap_referencia: 2.0 },
  { codigo: '1011-2/01', descricao: 'Frigorífico — abate de bovinos', secao: 'C', divisao: '10', grupo: '101', classe: '1011-2', subclasse: '01', grau_risco: 3, nrs_aplicaveis: [1, 4, 5, 6, 7, 9, 12, 15, 17, 36], exige_sesmt: true, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: true, atividade_perigosa: false, aliquota_rat: 3.0, fap_referencia: 1.5 },
  { codigo: '6311-9/00', descricao: 'Tratamento de dados, provedores de hospedagem e serviços relacionados', secao: 'J', divisao: '63', grupo: '631', classe: '6311-9', subclasse: '00', grau_risco: 1, nrs_aplicaveis: [1, 5, 7, 10, 17], exige_sesmt: false, exige_cipa: false, exige_pcmso: true, exige_pgr: true, atividade_insalubre: false, atividade_perigosa: false, aliquota_rat: 1.0, fap_referencia: 0.8 },
  { codigo: '4221-9/02', descricao: 'Construção de estações e redes de distribuição de energia elétrica', secao: 'F', divisao: '42', grupo: '422', classe: '4221-9', subclasse: '02', grau_risco: 4, nrs_aplicaveis: [1, 4, 5, 6, 7, 9, 10, 18, 35], exige_sesmt: true, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: false, atividade_perigosa: true, aliquota_rat: 3.0, fap_referencia: 1.8 },
  { codigo: '8121-4/00', descricao: 'Limpeza em prédios e em domicílios', secao: 'N', divisao: '81', grupo: '812', classe: '8121-4', subclasse: '00', grau_risco: 2, nrs_aplicaveis: [1, 5, 6, 7, 9, 15, 38], exige_sesmt: false, exige_cipa: true, exige_pcmso: true, exige_pgr: true, atividade_insalubre: true, atividade_perigosa: false, aliquota_rat: 2.0, fap_referencia: 1.1 },
];

export function createCnaeAdapter(): LegalSourceAdapter<CnaeRecord> {
  return {
    sourceId: 'cnae',
    sourceName: 'CNAE — Classificação Nacional de Atividades Econômicas',
    sourceUrl: 'https://cnae.ibge.gov.br/',

    async fetchAll(_tenantId) {
      return { success: true, data: [...CNAE_CATALOG], source: 'cnae', fetchedAt: new Date().toISOString() };
    },

    async fetchByCode(_tenantId, code) {
      const normalized = code.replace(/[.\-\/\s]/g, '');
      const found = CNAE_CATALOG.find(c => c.codigo.replace(/[.\-\/\s]/g, '') === normalized) ?? null;
      return { success: true, data: found, source: 'cnae', fetchedAt: new Date().toISOString() };
    },

    async checkForUpdates(_since) {
      // CNAE table changes infrequently; static for now
      return {
        success: true,
        data: { hasUpdates: false, lastChecked: new Date().toISOString(), updatedItems: [] },
        source: 'cnae',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
