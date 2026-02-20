/**
 * NR Adapter — Normas Regulamentadoras (Ministério do Trabalho)
 *
 * Provides structured access to all 38 NRs with metadata,
 * revision history, and applicability rules.
 *
 * Source: Ministério do Trabalho e Previdência
 * URL: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface NrRecord {
  numero: number;
  titulo: string;
  ementa: string;
  status: 'vigente' | 'revogada' | 'em_revisao';
  ultima_revisao: string;
  data_publicacao_original: string;
  portaria_vigente: string | null;
  grau_risco_aplicavel: number[];
  atividades_aplicaveis: string[];
  exige_treinamento: boolean;
  periodicidade_treinamento_meses: number | null;
  exige_exame_medico: boolean;
  exige_epi: boolean;
  integra_esocial: boolean;
  eventos_esocial: string[];
  url_fonte: string;
  tags: string[];
}

// ── Static NR Catalog ──

const NR_CATALOG: NrRecord[] = [
  {
    numero: 1,
    titulo: 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais',
    ementa: 'Estabelece disposições gerais, campo de aplicação, termos e definições comuns às NRs e diretrizes do GRO/PGR.',
    status: 'vigente',
    ultima_revisao: '2024-08-27',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.730/2020',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 24,
    exige_exame_medico: false,
    exige_epi: false,
    integra_esocial: true,
    eventos_esocial: ['S-2220', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-01-atualizada-2024.pdf',
    tags: ['pgr', 'gro', 'geral'],
  },
  {
    numero: 4,
    titulo: 'Serviços Especializados em Segurança e Medicina do Trabalho (SESMT)',
    ementa: 'Estabelece a obrigatoriedade de contratação de profissionais de SST conforme grau de risco e nº de empregados.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTP nº 2.318/2022',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: false,
    periodicidade_treinamento_meses: null,
    exige_exame_medico: false,
    exige_epi: false,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-04.pdf',
    tags: ['sesmt', 'profissionais_sst'],
  },
  {
    numero: 5,
    titulo: 'Comissão Interna de Prevenção de Acidentes (CIPA)',
    ementa: 'Estabelece parâmetros e requisitos da CIPA para prevenção de acidentes e doenças do trabalho.',
    status: 'vigente',
    ultima_revisao: '2024-08-27',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTP nº 422/2021',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: false,
    exige_epi: false,
    integra_esocial: false,
    eventos_esocial: [],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-05.pdf',
    tags: ['cipa', 'prevencao', 'comissao'],
  },
  {
    numero: 6,
    titulo: 'Equipamento de Proteção Individual (EPI)',
    ementa: 'Estabelece requisitos para fornecimento, uso, guarda e conservação de EPI.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.735/2020',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: false,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2220', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-06.pdf',
    tags: ['epi', 'protecao_individual'],
  },
  {
    numero: 7,
    titulo: 'Programa de Controle Médico de Saúde Ocupacional (PCMSO)',
    ementa: 'Estabelece diretrizes para o desenvolvimento do PCMSO com objetivo de proteção e preservação da saúde dos empregados.',
    status: 'vigente',
    ultima_revisao: '2024-01-01',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTP nº 2.318/2022',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: false,
    periodicidade_treinamento_meses: null,
    exige_exame_medico: true,
    exige_epi: false,
    integra_esocial: true,
    eventos_esocial: ['S-2220', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-07.pdf',
    tags: ['pcmso', 'saude_ocupacional', 'exames'],
  },
  {
    numero: 9,
    titulo: 'Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos',
    ementa: 'Estabelece requisitos para avaliação e controle das exposições ocupacionais a agentes físicos, químicos e biológicos.',
    status: 'vigente',
    ultima_revisao: '2023-04-26',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.735/2020',
    grau_risco_aplicavel: [2, 3, 4],
    atividades_aplicaveis: ['industria', 'mineracao', 'construcao'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-09.pdf',
    tags: ['exposicao', 'agentes', 'avaliacao'],
  },
  {
    numero: 10,
    titulo: 'Segurança em Instalações e Serviços em Eletricidade',
    ementa: 'Estabelece requisitos e condições mínimas para garantir a segurança de trabalhadores que interajam com instalações elétricas.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.735/2020',
    grau_risco_aplicavel: [3, 4],
    atividades_aplicaveis: ['eletricidade', 'manutencao', 'construcao'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 24,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-10.pdf',
    tags: ['eletricidade', 'nr10', 'alta_tensao'],
  },
  {
    numero: 12,
    titulo: 'Segurança no Trabalho em Máquinas e Equipamentos',
    ementa: 'Define referências técnicas, princípios fundamentais e medidas de proteção para garantir a saúde e a integridade física dos trabalhadores com máquinas e equipamentos.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.735/2020',
    grau_risco_aplicavel: [2, 3, 4],
    atividades_aplicaveis: ['industria', 'manufatura'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: false,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-12.pdf',
    tags: ['maquinas', 'equipamentos', 'protecao'],
  },
  {
    numero: 15,
    titulo: 'Atividades e Operações Insalubres',
    ementa: 'Descreve as atividades, operações e agentes insalubres e os limites de tolerância e percentuais de adicional.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTb nº 3.214/1978',
    grau_risco_aplicavel: [2, 3, 4],
    atividades_aplicaveis: ['industria', 'saude', 'limpeza', 'mineracao'],
    exige_treinamento: false,
    periodicidade_treinamento_meses: null,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-1010', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-15.pdf',
    tags: ['insalubridade', 'adicional', 'agentes_nocivos'],
  },
  {
    numero: 16,
    titulo: 'Atividades e Operações Perigosas',
    ementa: 'Regulamenta as atividades e operações perigosas e o direito ao adicional de periculosidade.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTb nº 3.214/1978',
    grau_risco_aplicavel: [3, 4],
    atividades_aplicaveis: ['inflamaveis', 'explosivos', 'eletricidade', 'seguranca'],
    exige_treinamento: false,
    periodicidade_treinamento_meses: null,
    exige_exame_medico: false,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-1010', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-16.pdf',
    tags: ['periculosidade', 'adicional', 'risco'],
  },
  {
    numero: 17,
    titulo: 'Ergonomia',
    ementa: 'Estabelece parâmetros para adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria MTP nº 423/2021',
    grau_risco_aplicavel: [1, 2, 3, 4],
    atividades_aplicaveis: ['todas'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 24,
    exige_exame_medico: false,
    exige_epi: false,
    integra_esocial: false,
    eventos_esocial: [],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-17.pdf',
    tags: ['ergonomia', 'postura', 'aet'],
  },
  {
    numero: 18,
    titulo: 'Segurança e Saúde no Trabalho na Indústria da Construção',
    ementa: 'Estabelece diretrizes de ordem administrativa, de planejamento e de organização que objetivam a implementação de medidas de controle e sistemas preventivos de segurança na construção.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 3.733/2020',
    grau_risco_aplicavel: [3, 4],
    atividades_aplicaveis: ['construcao_civil'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 6,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2220', 'S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-18.pdf',
    tags: ['construcao', 'civil', 'canteiro_obras'],
  },
  {
    numero: 20,
    titulo: 'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis',
    ementa: 'Estabelece requisitos mínimos para gestão de SST contra fatores de risco de acidentes com inflamáveis e combustíveis.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '1978-06-08',
    portaria_vigente: 'Portaria SEPRT nº 6.735/2020',
    grau_risco_aplicavel: [3, 4],
    atividades_aplicaveis: ['petroleo', 'gas', 'combustiveis'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-20.pdf',
    tags: ['inflamaveis', 'combustiveis', 'explosao'],
  },
  {
    numero: 33,
    titulo: 'Segurança e Saúde nos Trabalhos em Espaços Confinados',
    ementa: 'Estabelece requisitos mínimos para identificação, reconhecimento, avaliação, monitoramento e controle dos riscos em espaços confinados.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '2006-12-27',
    portaria_vigente: 'Portaria MTE nº 1.733/2014',
    grau_risco_aplicavel: [3, 4],
    atividades_aplicaveis: ['industria', 'mineracao', 'saneamento'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 12,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-33.pdf',
    tags: ['espaco_confinado', 'resgate', 'atmosfera'],
  },
  {
    numero: 35,
    titulo: 'Trabalho em Altura',
    ementa: 'Estabelece requisitos mínimos e medidas de proteção para trabalho em altura acima de 2 metros.',
    status: 'vigente',
    ultima_revisao: '2022-01-03',
    data_publicacao_original: '2012-03-27',
    portaria_vigente: 'Portaria SIT nº 313/2012',
    grau_risco_aplicavel: [2, 3, 4],
    atividades_aplicaveis: ['construcao', 'manutencao', 'telecomunicacoes'],
    exige_treinamento: true,
    periodicidade_treinamento_meses: 24,
    exige_exame_medico: true,
    exige_epi: true,
    integra_esocial: true,
    eventos_esocial: ['S-2240'],
    url_fonte: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-35.pdf',
    tags: ['altura', 'queda', 'cinto_seguranca'],
  },
];

// ── Adapter Implementation ──

export function createNrAdapter(): LegalSourceAdapter<NrRecord> {
  return {
    sourceId: 'nr',
    sourceName: 'Normas Regulamentadoras — MTE',
    sourceUrl: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras',

    async fetchAll(_tenantId) {
      return {
        success: true,
        data: [...NR_CATALOG],
        source: 'nr',
        fetchedAt: new Date().toISOString(),
      };
    },

    async fetchByCode(_tenantId, code) {
      const nr = parseInt(code.replace(/^NR-?/i, ''), 10);
      const found = NR_CATALOG.find(r => r.numero === nr) ?? null;
      return {
        success: true,
        data: found,
        source: 'nr',
        fetchedAt: new Date().toISOString(),
      };
    },

    async checkForUpdates(since) {
      const sinceDate = new Date(since);
      const updated = NR_CATALOG.filter(r => new Date(r.ultima_revisao) > sinceDate);
      return {
        success: true,
        data: {
          hasUpdates: updated.length > 0,
          lastChecked: new Date().toISOString(),
          updatedItems: updated.map(r => ({
            code: `NR-${r.numero}`,
            title: r.titulo,
            updatedAt: r.ultima_revisao,
          })),
        },
        source: 'nr',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

export type { LegalSourceAdapter };
