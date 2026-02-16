/**
 * NR Training Mapper Engine
 *
 * Maps NR (Normas Regulamentadoras) requirements and training
 * obligations based on CNAE risk grade and applicable risk categories.
 */

import type {
  GrauRisco,
  NrRequirement,
  TrainingRequirement,
  NrPriority,
} from './types';

// ─── NR Requirements Database ───

const NR_DATABASE: NrRequirement[] = [
  // Universais (todas as empresas)
  { nr_number: 1, nr_title: 'Disposições Gerais e Gerenciamento de Riscos', description: 'Programa de Gerenciamento de Riscos obrigatório', priority: 'obrigatoria', applies_to_grau_risco: [1,2,3,4], conditions: null },
  { nr_number: 4, nr_title: 'SESMT', description: 'Serviço Especializado em Engenharia de Segurança e Medicina do Trabalho', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Obrigatório conforme grau de risco e número de empregados (Quadro II)' },
  { nr_number: 5, nr_title: 'CIPA', description: 'Comissão Interna de Prevenção de Acidentes e Assédio', priority: 'obrigatoria', applies_to_grau_risco: [1,2,3,4], conditions: null },
  { nr_number: 7, nr_title: 'PCMSO', description: 'Programa de Controle Médico de Saúde Ocupacional', priority: 'obrigatoria', applies_to_grau_risco: [1,2,3,4], conditions: null },
  { nr_number: 9, nr_title: 'Avaliação e Controle de Exposições Ocupacionais', description: 'Agentes físicos, químicos e biológicos', priority: 'obrigatoria', applies_to_grau_risco: [1,2,3,4], conditions: null },
  { nr_number: 17, nr_title: 'Ergonomia', description: 'Adaptação das condições de trabalho', priority: 'obrigatoria', applies_to_grau_risco: [1,2,3,4], conditions: null },

  // Condicionais por risco
  { nr_number: 6, nr_title: 'EPI', description: 'Equipamento de Proteção Individual', priority: 'obrigatoria', applies_to_grau_risco: [2,3,4], conditions: 'Quando houver exposição a agentes de risco' },
  { nr_number: 10, nr_title: 'Segurança em Instalações Elétricas', description: 'Serviços em eletricidade', priority: 'condicional', applies_to_grau_risco: [2,3,4], conditions: 'Quando houver trabalho com eletricidade' },
  { nr_number: 11, nr_title: 'Transporte e Movimentação de Cargas', description: 'Operação de equipamentos de transporte', priority: 'condicional', applies_to_grau_risco: [2,3,4], conditions: 'Quando houver movimentação mecanizada de cargas' },
  { nr_number: 12, nr_title: 'Segurança em Máquinas e Equipamentos', description: 'Proteção em máquinas industriais', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Quando houver operação de máquinas' },
  { nr_number: 15, nr_title: 'Atividades Insalubres', description: 'Adicional de insalubridade', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Quando houver exposição acima dos limites de tolerância' },
  { nr_number: 16, nr_title: 'Atividades Perigosas', description: 'Adicional de periculosidade', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Inflamáveis, explosivos, eletricidade, radiação' },
  { nr_number: 18, nr_title: 'Segurança na Construção', description: 'Condições de trabalho na construção civil', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Atividades de construção, demolição e reforma' },
  { nr_number: 20, nr_title: 'Explosivos', description: 'Segurança com explosivos', priority: 'condicional', applies_to_grau_risco: [4], conditions: 'Fabricação, manuseio e transporte de explosivos' },
  { nr_number: 32, nr_title: 'Segurança em Serviços de Saúde', description: 'Estabelecimentos de saúde', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Estabelecimentos de assistência à saúde' },
  { nr_number: 33, nr_title: 'Espaços Confinados', description: 'Trabalho em espaços confinados', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Quando houver entrada em espaços confinados' },
  { nr_number: 35, nr_title: 'Trabalho em Altura', description: 'Atividades acima de 2 metros', priority: 'condicional', applies_to_grau_risco: [3,4], conditions: 'Quando houver trabalho acima de 2m do piso' },
];

// ─── Training Requirements Database ───

const TRAINING_DATABASE: TrainingRequirement[] = [
  // NR-1 (PGR)
  { nr_number: 1, training_name: 'Treinamento sobre GRO/PGR', workload_hours: 2, periodicity: 'admissional', validity_months: null, target_cbos: [], priority: 'obrigatoria', legal_basis: 'NR-1, item 1.7.1' },

  // NR-5 (CIPA)
  { nr_number: 5, training_name: 'Treinamento de CIPA', workload_hours: 20, periodicity: 'periodico', validity_months: 12, target_cbos: [], priority: 'obrigatoria', legal_basis: 'NR-5, item 5.7.1' },

  // NR-6 (EPI)
  { nr_number: 6, training_name: 'Uso correto de EPI', workload_hours: 2, periodicity: 'admissional', validity_months: null, target_cbos: [], priority: 'obrigatoria', legal_basis: 'NR-6, item 6.6.1' },

  // NR-10 (Eletricidade)
  { nr_number: 10, training_name: 'NR-10 Básico - Segurança em Eletricidade', workload_hours: 40, periodicity: 'periodico', validity_months: 24, target_cbos: ['7241-10', '7321-05'], priority: 'obrigatoria', legal_basis: 'NR-10, item 10.8.8' },
  { nr_number: 10, training_name: 'NR-10 Complementar (SEP)', workload_hours: 40, periodicity: 'periodico', validity_months: 24, target_cbos: ['7241-10'], priority: 'condicional', legal_basis: 'NR-10, item 10.8.8.2' },

  // NR-11 (Empilhadeira)
  { nr_number: 11, training_name: 'Operação de Empilhadeira', workload_hours: 16, periodicity: 'periodico', validity_months: 12, target_cbos: ['8610-10'], priority: 'obrigatoria', legal_basis: 'NR-11, item 11.1.5' },

  // NR-12 (Máquinas)
  { nr_number: 12, training_name: 'Segurança em Máquinas e Equipamentos', workload_hours: 8, periodicity: 'admissional', validity_months: null, target_cbos: ['7210-05'], priority: 'obrigatoria', legal_basis: 'NR-12, item 12.16.1' },

  // NR-18 (Construção)
  { nr_number: 18, training_name: 'Treinamento Admissional NR-18', workload_hours: 6, periodicity: 'admissional', validity_months: null, target_cbos: ['7170-20', '7241-10'], priority: 'obrigatoria', legal_basis: 'NR-18, item 18.28.1' },

  // NR-32 (Saúde)
  { nr_number: 32, training_name: 'Capacitação NR-32 - Biossegurança', workload_hours: 8, periodicity: 'admissional', validity_months: 12, target_cbos: ['2231-01', '2235-05', '3222-05'], priority: 'obrigatoria', legal_basis: 'NR-32, item 32.2.4.9' },

  // NR-33 (Espaços Confinados)
  { nr_number: 33, training_name: 'Trabalhador Autorizado - Espaço Confinado', workload_hours: 16, periodicity: 'periodico', validity_months: 12, target_cbos: [], priority: 'condicional', legal_basis: 'NR-33, item 33.3.5.4' },
  { nr_number: 33, training_name: 'Vigia de Espaço Confinado', workload_hours: 16, periodicity: 'periodico', validity_months: 12, target_cbos: [], priority: 'condicional', legal_basis: 'NR-33, item 33.3.5.4' },

  // NR-35 (Altura)
  { nr_number: 35, training_name: 'Trabalho em Altura', workload_hours: 8, periodicity: 'periodico', validity_months: 24, target_cbos: ['7170-20', '7241-10'], priority: 'condicional', legal_basis: 'NR-35, item 35.3.2' },
];

// ─── Public API ───

export function getApplicableNrs(grauRisco: GrauRisco): NrRequirement[] {
  return NR_DATABASE.filter(nr =>
    nr.applies_to_grau_risco.includes(grauRisco)
  );
}

export function getTrainingRequirements(
  grauRisco: GrauRisco,
  applicableNrNumbers: number[],
  cboCodes: string[] = []
): TrainingRequirement[] {
  return TRAINING_DATABASE.filter(training => {
    // Must be from an applicable NR
    if (!applicableNrNumbers.includes(training.nr_number)) return false;

    // If training targets specific CBOs and we have CBO data, filter
    if (training.target_cbos.length > 0 && cboCodes.length > 0) {
      const hasMatchingCbo = training.target_cbos.some(tc => cboCodes.includes(tc));
      if (!hasMatchingCbo) return false;
    }

    return true;
  });
}

export function estimateTrainingHours(trainings: TrainingRequirement[]): number {
  return trainings.reduce((sum, t) => sum + t.workload_hours, 0);
}
