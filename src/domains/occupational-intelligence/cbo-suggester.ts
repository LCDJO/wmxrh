/**
 * CBO Suggester Engine
 *
 * Suggests probable CBO (Classificação Brasileira de Ocupações)
 * codes based on the company's CNAE activity sector.
 */

import type { CboSuggestion, CboInfo } from './types';

// ─── CBO Database (principais famílias por divisão CNAE) ───

interface CboEntry extends CboInfo {
  cnae_divisions: string[];
}

const CBO_DATABASE: CboEntry[] = [
  // Administrativo / Geral
  { code: '4110-10', title: 'Auxiliar de Escritório', family: '4110', description: 'Atividades administrativas gerais', cnae_divisions: ['01','10','14','45','46','47','58','62','64','68','69','70','82','85'] },
  { code: '2521-05', title: 'Administrador', family: '2521', description: 'Gestão empresarial', cnae_divisions: ['62','64','69','70','82'] },
  { code: '2524-05', title: 'Analista de Recursos Humanos', family: '2524', description: 'Gestão de pessoas', cnae_divisions: ['62','64','69','70','78','82'] },

  // TI
  { code: '2124-05', title: 'Analista de Sistemas', family: '2124', description: 'Desenvolvimento de software', cnae_divisions: ['58','62','63'] },
  { code: '2123-05', title: 'Programador de Sistemas', family: '2123', description: 'Programação', cnae_divisions: ['58','62','63'] },
  { code: '2123-10', title: 'Desenvolvedor Web', family: '2123', description: 'Desenvolvimento web', cnae_divisions: ['58','62','63'] },

  // Saúde
  { code: '2231-01', title: 'Médico Clínico', family: '2231', description: 'Medicina geral', cnae_divisions: ['86','87'] },
  { code: '2235-05', title: 'Enfermeiro', family: '2235', description: 'Enfermagem', cnae_divisions: ['86','87','88'] },
  { code: '3222-05', title: 'Técnico de Enfermagem', family: '3222', description: 'Assistência de enfermagem', cnae_divisions: ['86','87','88'] },

  // Construção
  { code: '7170-20', title: 'Pedreiro', family: '7170', description: 'Construção civil', cnae_divisions: ['41','42','43'] },
  { code: '2142-05', title: 'Engenheiro Civil', family: '2142', description: 'Engenharia civil', cnae_divisions: ['41','42','43','71'] },
  { code: '7241-10', title: 'Eletricista de Instalações', family: '7241', description: 'Instalações elétricas', cnae_divisions: ['35','41','42','43'] },

  // Indústria
  { code: '7210-05', title: 'Operador de Máquinas', family: '7210', description: 'Operação industrial', cnae_divisions: ['05','06','07','08','10','13','16','20','22','23','24','25','28','29'] },
  { code: '8610-10', title: 'Operador de Empilhadeira', family: '8610', description: 'Movimentação de carga', cnae_divisions: ['10','24','25','46','49','52'] },
  { code: '2144-05', title: 'Engenheiro Mecânico', family: '2144', description: 'Engenharia mecânica', cnae_divisions: ['24','25','27','28','29','30'] },
  { code: '2149-05', title: 'Engenheiro de Segurança do Trabalho', family: '2149', description: 'Segurança ocupacional', cnae_divisions: ['05','06','07','08','10','20','23','24','25','29','35','41','42','43'] },

  // Comércio
  { code: '5211-10', title: 'Vendedor de Comércio', family: '5211', description: 'Vendas no varejo', cnae_divisions: ['45','47'] },
  { code: '4101-05', title: 'Caixa de Comércio', family: '4101', description: 'Operação de caixa', cnae_divisions: ['47','55','56'] },

  // Transporte
  { code: '7823-05', title: 'Motorista de Caminhão', family: '7823', description: 'Transporte rodoviário', cnae_divisions: ['49','52','53'] },
  { code: '7824-10', title: 'Motorista de Ônibus', family: '7824', description: 'Transporte coletivo', cnae_divisions: ['49'] },

  // Alimentação
  { code: '5132-05', title: 'Cozinheiro', family: '5132', description: 'Preparação de alimentos', cnae_divisions: ['55','56'] },
  { code: '5134-25', title: 'Garçom', family: '5134', description: 'Serviço de mesa', cnae_divisions: ['55','56'] },

  // Agropecuária
  { code: '6210-05', title: 'Trabalhador Agropecuário', family: '6210', description: 'Trabalho rural', cnae_divisions: ['01','02','03'] },

  // Segurança
  { code: '5173-10', title: 'Vigilante', family: '5173', description: 'Segurança patrimonial', cnae_divisions: ['80'] },

  // Limpeza
  { code: '5143-20', title: 'Faxineiro', family: '5143', description: 'Limpeza', cnae_divisions: ['81'] },

  // Contabilidade / Financeiro
  { code: '2522-10', title: 'Contador', family: '2522', description: 'Contabilidade', cnae_divisions: ['64','65','66','69'] },
  { code: '4131-10', title: 'Auxiliar Financeiro', family: '4131', description: 'Apoio financeiro', cnae_divisions: ['64','65','66','69','70'] },
];

// ─── Public API ───

export function suggestCbos(cnaeDivision: string, maxResults = 10): CboSuggestion[] {
  const scored = CBO_DATABASE
    .map(entry => {
      const matches = entry.cnae_divisions.includes(cnaeDivision);
      if (!matches) return null;

      const relevance = Math.min(1, 0.5 + (1 / entry.cnae_divisions.length) * 0.5);
      return {
        cbo: {
          code: entry.code,
          title: entry.title,
          family: entry.family,
          description: entry.description,
        },
        relevance: Math.round(relevance * 100) / 100,
        reason: `CBO típico para atividades CNAE divisão ${cnaeDivision}`,
        typical_cnae_codes: entry.cnae_divisions,
      } satisfies CboSuggestion;
    })
    .filter((s): s is CboSuggestion => s !== null)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxResults);

  return scored;
}

export function getCboByCode(code: string): CboInfo | null {
  const entry = CBO_DATABASE.find(e => e.code === code);
  if (!entry) return null;
  return { code: entry.code, title: entry.title, family: entry.family, description: entry.description };
}
