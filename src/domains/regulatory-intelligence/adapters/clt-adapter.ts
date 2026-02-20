/**
 * CLT Adapter — Consolidação das Leis do Trabalho
 *
 * Structured access to key CLT articles relevant to HR operations,
 * payroll, benefits, working hours, and occupational health.
 *
 * Source: Planalto (Decreto-Lei nº 5.452/1943)
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface CltArticle {
  artigo: string;
  titulo: string;
  capitulo: string;
  secao: string | null;
  texto_resumido: string;
  tema: CltTema;
  impacto_folha: boolean;
  impacto_esocial: boolean;
  eventos_esocial: string[];
  reforma_trabalhista_2017: boolean;
  url_fonte: string;
  ultima_atualizacao: string;
}

export type CltTema =
  | 'jornada'
  | 'ferias'
  | 'remuneracao'
  | 'rescisao'
  | 'fgts'
  | 'aviso_previo'
  | 'estabilidade'
  | 'insalubridade'
  | 'periculosidade'
  | 'adicional_noturno'
  | 'horas_extras'
  | 'descanso'
  | 'contrato'
  | 'gestante'
  | 'menor_aprendiz'
  | 'terceirizacao'
  | 'trabalho_remoto'
  | 'sindical';

const CLT_ARTICLES: CltArticle[] = [
  {
    artigo: 'Art. 58',
    titulo: 'Duração Normal do Trabalho',
    capitulo: 'Da Duração do Trabalho',
    secao: 'Da Jornada de Trabalho',
    texto_resumido: 'A duração normal do trabalho não excederá 8 horas diárias, desde que não seja fixado expressamente outro limite.',
    tema: 'jornada',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-2200', 'S-2206'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art58',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 59',
    titulo: 'Horas Extraordinárias',
    capitulo: 'Da Duração do Trabalho',
    secao: 'Da Jornada de Trabalho',
    texto_resumido: 'A duração diária do trabalho poderá ser acrescida de horas extras, em número não excedente de 2h, por acordo individual, convenção ou acordo coletivo.',
    tema: 'horas_extras',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-1200', 'S-1210'],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art59',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 71',
    titulo: 'Intervalo para Repouso',
    capitulo: 'Da Duração do Trabalho',
    secao: 'Dos Períodos de Descanso',
    texto_resumido: 'Em qualquer trabalho contínuo de duração superior a 6h é obrigatória a concessão de intervalo mínimo de 1h para repouso ou alimentação.',
    tema: 'descanso',
    impacto_folha: true,
    impacto_esocial: false,
    eventos_esocial: [],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art71',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 73',
    titulo: 'Trabalho Noturno',
    capitulo: 'Da Duração do Trabalho',
    secao: 'Do Trabalho Noturno',
    texto_resumido: 'O trabalho noturno urbano (22h-5h) terá remuneração superior à do diurno com acréscimo de pelo menos 20%.',
    tema: 'adicional_noturno',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-1200'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art73',
    ultima_atualizacao: '1943-05-01',
  },
  {
    artigo: 'Art. 129-145',
    titulo: 'Férias Anuais',
    capitulo: 'Das Férias Anuais',
    secao: null,
    texto_resumido: 'Todo empregado terá direito anualmente ao gozo de um período de férias (30 dias para até 5 faltas). Férias podem ser fracionadas em até 3 períodos.',
    tema: 'ferias',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-2230'],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art129',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 168',
    titulo: 'Exame Médico Obrigatório',
    capitulo: 'Da Segurança e Medicina do Trabalho',
    secao: null,
    texto_resumido: 'Será obrigatório exame médico do empregado: admissional, periódico, demissional, retorno ao trabalho e mudança de riscos.',
    tema: 'insalubridade',
    impacto_folha: false,
    impacto_esocial: true,
    eventos_esocial: ['S-2220'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art168',
    ultima_atualizacao: '1977-12-22',
  },
  {
    artigo: 'Art. 192',
    titulo: 'Adicional de Insalubridade',
    capitulo: 'Da Segurança e Medicina do Trabalho',
    secao: 'Das Atividades Insalubres',
    texto_resumido: 'O exercício de trabalho em condições insalubres assegura adicional de 40%, 20% ou 10% do salário mínimo conforme grau máximo, médio ou mínimo.',
    tema: 'insalubridade',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-1010', 'S-1200', 'S-2240'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art192',
    ultima_atualizacao: '1977-12-22',
  },
  {
    artigo: 'Art. 193',
    titulo: 'Adicional de Periculosidade',
    capitulo: 'Da Segurança e Medicina do Trabalho',
    secao: 'Das Atividades Perigosas',
    texto_resumido: 'São consideradas perigosas atividades com inflamáveis, explosivos, energia elétrica, roubos ou violência. Adicional de 30% sobre salário-base.',
    tema: 'periculosidade',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-1010', 'S-1200', 'S-2240'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art193',
    ultima_atualizacao: '2014-12-10',
  },
  {
    artigo: 'Art. 457-458',
    titulo: 'Remuneração — Composição',
    capitulo: 'Da Remuneração',
    secao: null,
    texto_resumido: 'Compreendem-se na remuneração do empregado o salário e gorjetas. Não integram: ajuda de custo, diárias, prêmios habituais, abonos.',
    tema: 'remuneracao',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-1010', 'S-1200'],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art457',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 477',
    titulo: 'Rescisão do Contrato de Trabalho',
    capitulo: 'Da Rescisão',
    secao: null,
    texto_resumido: 'Terminado o contrato, o empregador deverá anotar a CTPS e pagar verbas rescisórias em até 10 dias. Multa de um salário do empregado por atraso.',
    tema: 'rescisao',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-2299', 'S-2399'],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art477',
    ultima_atualizacao: '2017-11-11',
  },
  {
    artigo: 'Art. 487',
    titulo: 'Aviso Prévio',
    capitulo: 'Do Aviso Prévio',
    secao: null,
    texto_resumido: 'A parte que, sem justo motivo, rescindir o contrato deverá avisar com antecedência mínima de 30 dias (+ 3 dias/ano de serviço, até 90 dias).',
    tema: 'aviso_previo',
    impacto_folha: true,
    impacto_esocial: true,
    eventos_esocial: ['S-2299'],
    reforma_trabalhista_2017: false,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art487',
    ultima_atualizacao: '2011-10-13',
  },
  {
    artigo: 'Art. 75-A a 75-E',
    titulo: 'Teletrabalho',
    capitulo: 'Da Duração do Trabalho',
    secao: 'Do Teletrabalho',
    texto_resumido: 'Prestação de serviços fora das dependências do empregador com utilização de TI. Contrato deve especificar atividades. Reforma Trabalhista 2017.',
    tema: 'trabalho_remoto',
    impacto_folha: false,
    impacto_esocial: true,
    eventos_esocial: ['S-2200', 'S-2206'],
    reforma_trabalhista_2017: true,
    url_fonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm#art75a',
    ultima_atualizacao: '2022-03-28',
  },
];

export function createCltAdapter(): LegalSourceAdapter<CltArticle> {
  return {
    sourceId: 'clt',
    sourceName: 'Consolidação das Leis do Trabalho',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',

    async fetchAll(_tenantId) {
      return {
        success: true,
        data: [...CLT_ARTICLES],
        source: 'clt',
        fetchedAt: new Date().toISOString(),
      };
    },

    async fetchByCode(_tenantId, code) {
      const normalized = code.replace(/\s+/g, ' ').trim().toLowerCase();
      const found = CLT_ARTICLES.find(a =>
        a.artigo.toLowerCase().includes(normalized)
      ) ?? null;
      return {
        success: true,
        data: found,
        source: 'clt',
        fetchedAt: new Date().toISOString(),
      };
    },

    async checkForUpdates(since) {
      const sinceDate = new Date(since);
      const updated = CLT_ARTICLES.filter(a => new Date(a.ultima_atualizacao) > sinceDate);
      return {
        success: true,
        data: {
          hasUpdates: updated.length > 0,
          lastChecked: new Date().toISOString(),
          updatedItems: updated.map(a => ({
            code: a.artigo,
            title: a.titulo,
            updatedAt: a.ultima_atualizacao,
          })),
        },
        source: 'clt',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
