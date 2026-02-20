/**
 * CCT Adapter — Convenções Coletivas de Trabalho (Futuro)
 *
 * Stub adapter for future integration with union/syndicate
 * data sources (e.g., Mediador MTE, DIEESE).
 *
 * Source: Portal Mediador / MTE
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface CctRecord {
  registro_mte: string;
  tipo: 'CCT' | 'ACT';
  sindicato_laboral: string;
  sindicato_patronal: string | null;
  cnpj_sindicato: string | null;
  abrangencia_territorial: string;
  categorias_profissionais: string[];
  vigencia_inicio: string;
  vigencia_fim: string;
  data_registro: string;
  piso_salarial: number | null;
  reajuste_percentual: number | null;
  data_base_mes: number;
  jornada_semanal_horas: number | null;
  clausulas_destaque: CctClausulaDestaque[];
  url_documento: string | null;
  status: 'vigente' | 'expirada' | 'em_negociacao';
}

export interface CctClausulaDestaque {
  numero: string;
  titulo: string;
  resumo: string;
  impacto_folha: boolean;
  area: 'salario' | 'jornada' | 'beneficios' | 'saude' | 'estabilidade' | 'rescisao' | 'outros';
}

// ── Stub data (sample CCTs for demonstration) ──

const CCT_CATALOG: CctRecord[] = [
  {
    registro_mte: 'MR-000001/2024',
    tipo: 'CCT',
    sindicato_laboral: 'Sindicato dos Trabalhadores em Tecnologia da Informação do Estado de SP',
    sindicato_patronal: 'SEPROSP — Sindicato das Empresas de Processamento de Dados de SP',
    cnpj_sindicato: '00.000.000/0001-00',
    abrangencia_territorial: 'Estado de São Paulo',
    categorias_profissionais: ['Programadores', 'Analistas de Sistemas', 'Suporte Técnico'],
    vigencia_inicio: '2024-01-01',
    vigencia_fim: '2024-12-31',
    data_registro: '2024-02-15',
    piso_salarial: 3800.00,
    reajuste_percentual: 5.5,
    data_base_mes: 1,
    jornada_semanal_horas: 40,
    clausulas_destaque: [
      { numero: '5ª', titulo: 'Piso Salarial', resumo: 'Piso de R$ 3.800 para profissionais de TI com jornada de 40h.', impacto_folha: true, area: 'salario' },
      { numero: '8ª', titulo: 'Vale-Refeição', resumo: 'VR mínimo de R$ 35/dia útil.', impacto_folha: true, area: 'beneficios' },
      { numero: '12ª', titulo: 'Home Office', resumo: 'Auxílio home office de R$ 150/mês para regime remoto/híbrido.', impacto_folha: true, area: 'beneficios' },
    ],
    url_documento: null,
    status: 'vigente',
  },
  {
    registro_mte: 'MR-000042/2024',
    tipo: 'CCT',
    sindicato_laboral: 'Sindicato dos Trabalhadores na Construção Civil de SP',
    sindicato_patronal: 'SindusCon-SP',
    cnpj_sindicato: '11.111.111/0001-11',
    abrangencia_territorial: 'Município de São Paulo',
    categorias_profissionais: ['Pedreiros', 'Eletricistas', 'Armadores', 'Carpinteiros'],
    vigencia_inicio: '2024-05-01',
    vigencia_fim: '2025-04-30',
    data_registro: '2024-06-01',
    piso_salarial: 2200.00,
    reajuste_percentual: 6.8,
    data_base_mes: 5,
    jornada_semanal_horas: 44,
    clausulas_destaque: [
      { numero: '3ª', titulo: 'Piso Salarial', resumo: 'Piso de R$ 2.200 para pedreiros; pisos diferenciados por função.', impacto_folha: true, area: 'salario' },
      { numero: '15ª', titulo: 'Adicional de Insalubridade', resumo: 'Base de cálculo sobre salário normativo da categoria.', impacto_folha: true, area: 'salario' },
      { numero: '22ª', titulo: 'Cesta Básica', resumo: 'Cesta básica mensal de R$ 200 para todos os empregados.', impacto_folha: true, area: 'beneficios' },
      { numero: '30ª', titulo: 'Estabilidade Pré-Aposentadoria', resumo: '12 meses de estabilidade para empregados a 24 meses da aposentadoria.', impacto_folha: false, area: 'estabilidade' },
    ],
    url_documento: null,
    status: 'vigente',
  },
];

export function createCctAdapter(): LegalSourceAdapter<CctRecord> {
  return {
    sourceId: 'cct',
    sourceName: 'CCT — Convenções Coletivas de Trabalho (Futuro)',
    sourceUrl: 'https://www3.mte.gov.br/sistemas/mediador/',

    async fetchAll(_tenantId) {
      // Future: query Mediador API or tenant-specific CCT records
      return { success: true, data: [...CCT_CATALOG], source: 'cct', fetchedAt: new Date().toISOString() };
    },

    async fetchByCode(_tenantId, code) {
      const found = CCT_CATALOG.find(c => c.registro_mte === code) ?? null;
      return { success: true, data: found, source: 'cct', fetchedAt: new Date().toISOString() };
    },

    async checkForUpdates(since) {
      const sinceDate = new Date(since);
      const updated = CCT_CATALOG.filter(c => new Date(c.data_registro) > sinceDate);
      return {
        success: true,
        data: {
          hasUpdates: updated.length > 0,
          lastChecked: new Date().toISOString(),
          updatedItems: updated.map(c => ({
            code: c.registro_mte,
            title: `${c.tipo} — ${c.sindicato_laboral}`,
            updatedAt: c.data_registro,
          })),
        },
        source: 'cct',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
