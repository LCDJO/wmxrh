/**
 * eSocial Layout Adapter
 *
 * Structured access to eSocial event definitions,
 * field requirements, and layout versioning.
 *
 * Source: Portal eSocial / Manual de Orientação (MOS)
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface EsocialEvent {
  codigo: string;
  titulo: string;
  grupo: EsocialEventGroup;
  descricao: string;
  tipo: 'tabela' | 'nao_periodico' | 'periodico';
  prazo_envio: string;
  obrigatorio: boolean;
  campos_chave: string[];
  layout_versao: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  depende_de: string[];
  url_documentacao: string;
}

export type EsocialEventGroup =
  | 'tabelas'
  | 'nao_periodicos'
  | 'periodicos'
  | 'sst';

const ESOCIAL_EVENTS: EsocialEvent[] = [
  {
    codigo: 'S-1000',
    titulo: 'Informações do Empregador/Contribuinte/Órgão Público',
    grupo: 'tabelas',
    descricao: 'Identifica o empregador/contribuinte e contém dados cadastrais, alíquotas e demais condições fiscais.',
    tipo: 'tabela',
    prazo_envio: 'Antes de qualquer outro evento',
    obrigatorio: true,
    campos_chave: ['tpInsc', 'nrInsc', 'nmRazao', 'classTrib'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: [],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-1010',
    titulo: 'Tabela de Rubricas',
    grupo: 'tabelas',
    descricao: 'Apresenta o detalhamento das rubricas da folha de pagamento do empregador com natureza e incidências.',
    tipo: 'tabela',
    prazo_envio: 'Antes dos eventos periódicos (S-1200)',
    obrigatorio: true,
    campos_chave: ['codRubr', 'ideTabRubr', 'dscRubr', 'natRubr', 'tpRubr'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-1000'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-1200',
    titulo: 'Remuneração de Trabalhador Vinculado ao RGPS',
    grupo: 'periodicos',
    descricao: 'Informações da remuneração de cada trabalhador no mês de referência, incluindo rubricas de vencimento e desconto.',
    tipo: 'periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente',
    obrigatorio: true,
    campos_chave: ['perApur', 'cpfTrab', 'dmDev', 'ideEstabLot'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-1000', 'S-1010', 'S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-1210',
    titulo: 'Pagamentos de Rendimentos do Trabalho',
    grupo: 'periodicos',
    descricao: 'Informações dos pagamentos efetuados relativos a rendimentos do trabalho com ou sem vínculo.',
    tipo: 'periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente',
    obrigatorio: true,
    campos_chave: ['perApur', 'cpfTrab', 'dtPgto', 'vrLiq'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-1200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2200',
    titulo: 'Cadastramento Inicial / Admissão do Trabalhador',
    grupo: 'nao_periodicos',
    descricao: 'Registro de admissão do trabalhador com dados pessoais, contratuais e lotação tributária.',
    tipo: 'nao_periodico',
    prazo_envio: 'Até o dia anterior ao início da prestação de serviços',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'nmTrab', 'dtNascto', 'dtAdm', 'tpContr', 'codCargo'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-1000'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2206',
    titulo: 'Alteração de Contrato de Trabalho / Relação Estatutária',
    grupo: 'nao_periodicos',
    descricao: 'Alteração de dados do contrato de trabalho (salário, cargo, jornada, lotação).',
    tipo: 'nao_periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente à alteração',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'dtAlteracao', 'vrSalFx', 'codCargo'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2220',
    titulo: 'Monitoramento da Saúde do Trabalhador (ASO)',
    grupo: 'sst',
    descricao: 'Informações do ASO (Atestado de Saúde Ocupacional) do trabalhador, com exames realizados.',
    tipo: 'nao_periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente à realização do exame',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'dtAso', 'tpAso', 'exame'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2230',
    titulo: 'Afastamento Temporário',
    grupo: 'nao_periodicos',
    descricao: 'Informações de afastamento temporário do trabalhador (férias, licenças, auxílio-doença, etc.).',
    tipo: 'nao_periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente (ou imediato para afastamentos > 15 dias)',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'dtIniAfast', 'codMotAfast'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2240',
    titulo: 'Condições Ambientais do Trabalho — Agentes Nocivos',
    grupo: 'sst',
    descricao: 'Informações das condições ambientais de trabalho, fatores de risco e agentes nocivos a que o trabalhador está exposto.',
    tipo: 'nao_periodico',
    prazo_envio: 'Até o dia 15 do mês subsequente ao início da exposição',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'dtIniCondicao', 'codAgNoc', 'dscAgNoc', 'tpAval'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
  {
    codigo: 'S-2299',
    titulo: 'Desligamento',
    grupo: 'nao_periodicos',
    descricao: 'Informações do desligamento do trabalhador, incluindo verbas rescisórias calculadas.',
    tipo: 'nao_periodico',
    prazo_envio: 'Até 10 dias corridos a partir da data do desligamento',
    obrigatorio: true,
    campos_chave: ['cpfTrab', 'dtDeslig', 'mtvDeslig', 'vrSalFx'],
    layout_versao: 'S-1.2',
    vigencia_inicio: '2023-01-01',
    vigencia_fim: null,
    depende_de: ['S-2200'],
    url_documentacao: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais',
  },
];

export function createEsocialAdapter(): LegalSourceAdapter<EsocialEvent> {
  return {
    sourceId: 'esocial',
    sourceName: 'eSocial — Layout e Eventos',
    sourceUrl: 'https://www.gov.br/esocial/pt-br/documentacao-tecnica',

    async fetchAll(_tenantId) {
      return {
        success: true,
        data: [...ESOCIAL_EVENTS],
        source: 'esocial',
        fetchedAt: new Date().toISOString(),
      };
    },

    async fetchByCode(_tenantId, code) {
      const normalized = code.toUpperCase().replace(/\s/g, '');
      const found = ESOCIAL_EVENTS.find(e => e.codigo.replace('-', '') === normalized.replace('-', '')) ?? null;
      return {
        success: true,
        data: found,
        source: 'esocial',
        fetchedAt: new Date().toISOString(),
      };
    },

    async checkForUpdates(since) {
      const sinceDate = new Date(since);
      const updated = ESOCIAL_EVENTS.filter(e => new Date(e.vigencia_inicio) > sinceDate);
      return {
        success: true,
        data: {
          hasUpdates: updated.length > 0,
          lastChecked: new Date().toISOString(),
          updatedItems: updated.map(e => ({
            code: e.codigo,
            title: e.titulo,
            updatedAt: e.vigencia_inicio,
          })),
        },
        source: 'esocial',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
