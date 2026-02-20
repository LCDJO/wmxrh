/**
 * CBO Adapter — Classificação Brasileira de Ocupações
 *
 * Structured access to CBO codes with required training,
 * risk classification, and applicable NRs.
 *
 * Source: MTE / Portal CBO
 */

import type { LegalSourceAdapter, LegalSourceResult, LegalSourceUpdateCheck } from './types';

export interface CboRecord {
  codigo: string;
  titulo: string;
  familia: string;
  grande_grupo: string;
  descricao_sumaria: string;
  formacao_minima: string;
  experiencia_requerida: string | null;
  condicoes_gerais: string;
  nrs_aplicaveis: number[];
  risco_ocupacional: 'baixo' | 'medio' | 'alto' | 'muito_alto';
  exige_registro_profissional: boolean;
  conselho_profissional: string | null;
  atividades_principais: string[];
}

const CBO_CATALOG: CboRecord[] = [
  {
    codigo: '2124-05',
    titulo: 'Analista de Desenvolvimento de Sistemas',
    familia: '2124 — Analistas de sistemas computacionais',
    grande_grupo: '2 — Profissionais das ciências e das artes',
    descricao_sumaria: 'Desenvolvem e implantam sistemas informatizados, dimensionando requisitos e funcionalidades.',
    formacao_minima: 'Ensino Superior completo em TI ou áreas correlatas',
    experiencia_requerida: null,
    condicoes_gerais: 'Trabalho em ambientes climatizados, posição sentada prolongada.',
    nrs_aplicaveis: [1, 7, 17],
    risco_ocupacional: 'baixo',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Desenvolver sistemas', 'Administrar ambientes', 'Documentar sistemas'],
  },
  {
    codigo: '2516-05',
    titulo: 'Analista de Recursos Humanos',
    familia: '2516 — Profissionais de administração de pessoal',
    grande_grupo: '2 — Profissionais das ciências e das artes',
    descricao_sumaria: 'Administram pessoal e plano de cargos e salários. Promovem ações de treinamento e de desenvolvimento de pessoal.',
    formacao_minima: 'Ensino Superior completo em Administração, Psicologia ou áreas correlatas',
    experiencia_requerida: '1 a 2 anos',
    condicoes_gerais: 'Trabalho em ambientes internos, horário comercial.',
    nrs_aplicaveis: [1, 7, 17],
    risco_ocupacional: 'baixo',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Recrutar e selecionar', 'Administrar folha', 'Gerenciar benefícios', 'Desenvolver políticas de RH'],
  },
  {
    codigo: '7152-10',
    titulo: 'Eletricista de Instalações (Edifícios)',
    familia: '7152 — Eletricistas de manutenção eletroeletrônica',
    grande_grupo: '7 — Trabalhadores da produção de bens e serviços industriais',
    descricao_sumaria: 'Planejam, executam e mantêm instalações elétricas em edificações residenciais, comerciais e industriais.',
    formacao_minima: 'Ensino Médio completo + Curso NR-10',
    experiencia_requerida: '6 meses a 1 ano',
    condicoes_gerais: 'Trabalho em altura, exposição a risco elétrico, uso obrigatório de EPI.',
    nrs_aplicaveis: [1, 5, 6, 7, 10, 35],
    risco_ocupacional: 'alto',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Instalar fiação', 'Montar quadros elétricos', 'Realizar manutenção preventiva'],
  },
  {
    codigo: '2231-01',
    titulo: 'Médico do Trabalho',
    familia: '2231 — Médicos',
    grande_grupo: '2 — Profissionais das ciências e das artes',
    descricao_sumaria: 'Realiza consultas e atendimentos médicos ocupacionais. Implementa o PCMSO.',
    formacao_minima: 'Medicina + Residência ou Especialização em Medicina do Trabalho',
    experiencia_requerida: '2 anos',
    condicoes_gerais: 'Trabalho em ambulatórios e empresas.',
    nrs_aplicaveis: [1, 4, 7, 9],
    risco_ocupacional: 'medio',
    exige_registro_profissional: true,
    conselho_profissional: 'CRM',
    atividades_principais: ['Realizar exames ocupacionais', 'Elaborar PCMSO', 'Emitir ASO', 'Gerenciar saúde ocupacional'],
  },
  {
    codigo: '7170-20',
    titulo: 'Pedreiro',
    familia: '7170 — Trabalhadores de estruturas de alvenaria',
    grande_grupo: '7 — Trabalhadores da produção de bens e serviços industriais',
    descricao_sumaria: 'Organizam e preparam o local de trabalho na obra; constroem fundações e estruturas de alvenaria.',
    formacao_minima: 'Ensino Fundamental + Treinamento NR-18',
    experiencia_requerida: '1 a 2 anos',
    condicoes_gerais: 'Trabalho a céu aberto, esforço físico, exposição a poeira e ruído.',
    nrs_aplicaveis: [1, 5, 6, 7, 9, 12, 17, 18, 35],
    risco_ocupacional: 'alto',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Assentar alvenaria', 'Preparar argamassa', 'Construir estruturas'],
  },
  {
    codigo: '3222-05',
    titulo: 'Técnico de Enfermagem',
    familia: '3222 — Técnicos e auxiliares de enfermagem',
    grande_grupo: '3 — Técnicos de nível médio',
    descricao_sumaria: 'Desempenham atividades técnicas de enfermagem em hospitais, clínicas e outros estabelecimentos de assistência médica.',
    formacao_minima: 'Ensino Médio + Curso Técnico de Enfermagem + COREN',
    experiencia_requerida: null,
    condicoes_gerais: 'Trabalho em hospitais, plantões, exposição a agentes biológicos.',
    nrs_aplicaveis: [1, 5, 6, 7, 9, 15, 32],
    risco_ocupacional: 'alto',
    exige_registro_profissional: true,
    conselho_profissional: 'COREN',
    atividades_principais: ['Prestar cuidados de enfermagem', 'Administrar medicamentos', 'Realizar curativos'],
  },
  {
    codigo: '5143-20',
    titulo: 'Faxineiro / Auxiliar de Limpeza',
    familia: '5143 — Trabalhadores nos serviços de manutenção de edificações',
    grande_grupo: '5 — Trabalhadores dos serviços, vendedores do comércio',
    descricao_sumaria: 'Executam serviços de limpeza e conservação de ambientes.',
    formacao_minima: 'Ensino Fundamental',
    experiencia_requerida: null,
    condicoes_gerais: 'Trabalho em ambientes diversos, exposição a produtos químicos de limpeza.',
    nrs_aplicaveis: [1, 5, 6, 7, 9, 15],
    risco_ocupacional: 'medio',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Limpar ambientes', 'Operar equipamentos de limpeza', 'Manejar produtos químicos'],
  },
  {
    codigo: '4110-10',
    titulo: 'Auxiliar Administrativo',
    familia: '4110 — Agentes, assistentes e auxiliares administrativos',
    grande_grupo: '4 — Trabalhadores de serviços administrativos',
    descricao_sumaria: 'Executam serviços de apoio nas áreas de RH, administração, finanças e logística.',
    formacao_minima: 'Ensino Médio completo',
    experiencia_requerida: null,
    condicoes_gerais: 'Trabalho em escritórios, posição sentada.',
    nrs_aplicaveis: [1, 7, 17],
    risco_ocupacional: 'baixo',
    exige_registro_profissional: false,
    conselho_profissional: null,
    atividades_principais: ['Organizar documentos', 'Atender público', 'Controlar planilhas'],
  },
];

export function createCboAdapter(): LegalSourceAdapter<CboRecord> {
  return {
    sourceId: 'cbo',
    sourceName: 'CBO — Classificação Brasileira de Ocupações',
    sourceUrl: 'https://cbo.mte.gov.br/',

    async fetchAll(_tenantId) {
      return { success: true, data: [...CBO_CATALOG], source: 'cbo', fetchedAt: new Date().toISOString() };
    },

    async fetchByCode(_tenantId, code) {
      const normalized = code.replace(/[\-\s]/g, '');
      const found = CBO_CATALOG.find(c => c.codigo.replace(/[\-\s]/g, '') === normalized) ?? null;
      return { success: true, data: found, source: 'cbo', fetchedAt: new Date().toISOString() };
    },

    async checkForUpdates(_since) {
      return {
        success: true,
        data: { hasUpdates: false, lastChecked: new Date().toISOString(), updatedItems: [] },
        source: 'cbo',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
