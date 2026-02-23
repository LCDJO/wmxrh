/**
 * Automated Hiring — Etapa 2: Análise Legal do Cargo
 *
 * Integrates with Career & Legal Intelligence Engine to auto-generate:
 * 1. NRs obrigatórias (based on CNAE risk + CBO)
 * 2. Exames obrigatórios (PCMSO / NR-7)
 * 3. EPIs obrigatórios (NR-6 from risk profile)
 * 4. Adicionais legais (insalubridade / periculosidade)
 * 5. Piso salarial aplicável (CCT or national minimum)
 *
 * Pure engine — receives snapshots, returns analysis.
 * The orchestrator persists results via integration adapters.
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';

// ═══════════════════════════════════════════════
//  Output Types
// ═══════════════════════════════════════════════

export interface NrObrigatoria {
  nr_number: number;
  title: string;
  description: string;
  training_required: boolean;
  periodicidade_meses: number;
  legal_basis: string;
}

export interface ExameObrigatorio {
  tipo: 'admissional' | 'periodico' | 'retorno_trabalho' | 'mudanca_funcao' | 'demissional';
  descricao: string;
  periodicidade_meses: number | null;
  legal_basis: string;
  deadline_days: number;
}

export interface EpiObrigatorio {
  categoria: string;
  descricao: string;
  ca_required: boolean;
  legal_basis: string;
}

export interface AdicionalLegal {
  tipo: 'insalubridade' | 'periculosidade' | 'noturno' | 'transferencia';
  percentual: number;
  base_calculo: 'salario_minimo' | 'salario_base';
  grau?: 'minimo' | 'medio' | 'maximo';
  legal_basis: string;
  valor_estimado: number;
}

export interface PisoSalarialAplicavel {
  valor: number;
  fonte: 'cct' | 'salario_minimo_nacional' | 'salario_minimo_regional';
  vigencia: string | null;
  sindicato: string | null;
}

export interface AnaliseLegalCargoResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  nrs_obrigatorias: NrObrigatoria[];
  exames_obrigatorios: ExameObrigatorio[];
  epis_obrigatorios: EpiObrigatorio[];
  adicionais_legais: AdicionalLegal[];
  piso_salarial: PisoSalarialAplicavel;
  grau_risco: number;
  total_training_hours_estimated: number;
  analyzed_at: string;
}

// ═══════════════════════════════════════════════
//  Input
// ═══════════════════════════════════════════════

export interface AnaliseLegalCargoInput {
  cbo_code: string;
  cnae_code: string;
  /** Risk grade from CNAE classification (1-4) */
  grau_risco: number;
  /** NRs applicable based on CNAE/CBO from Occupational Intelligence */
  applicable_nrs: number[];
  /** Risk agents identified */
  risk_agents: string[];
  /** CCT salary data if available */
  cct_salary_floor: number | null;
  cct_salary_ceiling: number | null;
  cct_sindicato: string | null;
  cct_vigencia: string | null;
  /** Additional legal mapping (from Career Intelligence) */
  adicional_insalubridade: boolean;
  adicional_periculosidade: boolean;
  grau_insalubridade: 'minimo' | 'medio' | 'maximo' | null;
  /** Base salary proposed for cost estimation */
  salario_proposto: number;
}

// ═══════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════

const NATIONAL_MINIMUM_WAGE = 1518; // 2025/2026

const NR_CATALOG: Record<number, { title: string; desc: string; training: boolean; period: number }> = {
  1:  { title: 'Disposições Gerais e GRO', desc: 'Gerenciamento de Riscos Ocupacionais', training: true, period: 24 },
  5:  { title: 'CIPA', desc: 'Comissão Interna de Prevenção de Acidentes', training: true, period: 12 },
  6:  { title: 'EPI', desc: 'Equipamento de Proteção Individual', training: true, period: 12 },
  7:  { title: 'PCMSO', desc: 'Programa de Controle Médico de Saúde Ocupacional', training: false, period: 12 },
  9:  { title: 'Trabalho em Altura', desc: 'Condições e meio ambiente em edificações', training: true, period: 24 },
  10: { title: 'Segurança em Eletricidade', desc: 'Instalações e serviços em eletricidade', training: true, period: 24 },
  11: { title: 'Transporte e Movimentação', desc: 'Transporte, movimentação, armazenagem e manuseio de materiais', training: true, period: 12 },
  12: { title: 'Máquinas e Equipamentos', desc: 'Segurança no trabalho em máquinas e equipamentos', training: true, period: 12 },
  13: { title: 'Caldeiras e Vasos de Pressão', desc: 'Caldeiras, vasos de pressão e tubulações', training: true, period: 24 },
  15: { title: 'Insalubridade', desc: 'Atividades e operações insalubres', training: false, period: 0 },
  16: { title: 'Periculosidade', desc: 'Atividades e operações perigosas', training: false, period: 0 },
  17: { title: 'Ergonomia', desc: 'Ergonomia e condições de trabalho', training: true, period: 24 },
  18: { title: 'Construção Civil', desc: 'Condições de trabalho na indústria da construção', training: true, period: 12 },
  20: { title: 'Líquidos Combustíveis', desc: 'Segurança com líquidos combustíveis e inflamáveis', training: true, period: 12 },
  23: { title: 'Proteção contra Incêndio', desc: 'Proteção contra incêndios', training: true, period: 12 },
  24: { title: 'Condições Sanitárias', desc: 'Condições sanitárias e de conforto nos locais de trabalho', training: false, period: 0 },
  25: { title: 'Resíduos Industriais', desc: 'Resíduos industriais', training: true, period: 12 },
  26: { title: 'Sinalização de Segurança', desc: 'Sinalização de segurança', training: false, period: 0 },
  33: { title: 'Espaço Confinado', desc: 'Segurança e saúde nos trabalhos em espaços confinados', training: true, period: 12 },
  35: { title: 'Trabalho em Altura', desc: 'Trabalho em altura', training: true, period: 24 },
};

const EPI_BY_RISK: Record<string, { categoria: string; descricao: string }[]> = {
  'ruido': [
    { categoria: 'Proteção Auditiva', descricao: 'Protetor auricular tipo plug ou concha' },
  ],
  'quimico': [
    { categoria: 'Proteção Respiratória', descricao: 'Respirador semifacial ou máscara PFF2' },
    { categoria: 'Luvas Químicas', descricao: 'Luvas de proteção química (nitrila/PVC)' },
  ],
  'biologico': [
    { categoria: 'Luvas Procedimento', descricao: 'Luvas de procedimento descartáveis' },
    { categoria: 'Óculos de Proteção', descricao: 'Óculos de proteção contra respingos' },
  ],
  'mecanico': [
    { categoria: 'Calçado de Segurança', descricao: 'Botina/sapato com biqueira de aço' },
    { categoria: 'Luvas Mecânicas', descricao: 'Luvas de proteção contra agentes mecânicos' },
  ],
  'eletrico': [
    { categoria: 'Luvas Isolantes', descricao: 'Luvas isolantes de borracha (classe conforme tensão)' },
    { categoria: 'Calçado Isolante', descricao: 'Calçado isolante para eletricista' },
  ],
  'altura': [
    { categoria: 'Cinto de Segurança', descricao: 'Cinto de segurança tipo paraquedista com talabarte' },
    { categoria: 'Capacete', descricao: 'Capacete de segurança com jugular' },
  ],
  'termico': [
    { categoria: 'Vestimenta Térmica', descricao: 'Vestimenta de proteção contra calor ou frio' },
  ],
};

const INSALUBRIDADE_RATES = { minimo: 0.10, medio: 0.20, maximo: 0.40 } as const;
const PERICULOSIDADE_RATE = 0.30;

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

function blocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'position_mapping' };
}

export function analyzePositionLegal(input: AnaliseLegalCargoInput): AnaliseLegalCargoResult {
  const blockers: ComplianceBlocker[] = [];

  // Validate minimum inputs
  if (!input.cbo_code) blockers.push(blocker('NO_CBO', 'CBO não informado', 'Portaria 397/2002'));
  if (!input.cnae_code) blockers.push(blocker('NO_CNAE', 'CNAE não informado', 'NR-4'));

  // ── 1. NRs Obrigatórias ──
  const nrs: NrObrigatoria[] = [];
  // NR-1 (GRO) and NR-7 (PCMSO) always apply
  const mandatoryNrs = new Set([1, 7, ...input.applicable_nrs]);
  if (input.grau_risco >= 2) mandatoryNrs.add(5); // CIPA
  if (input.grau_risco >= 3) mandatoryNrs.add(6); // EPI

  for (const nr of Array.from(mandatoryNrs).sort((a, b) => a - b)) {
    const catalog = NR_CATALOG[nr];
    if (catalog) {
      nrs.push({
        nr_number: nr,
        title: catalog.title,
        description: catalog.desc,
        training_required: catalog.training,
        periodicidade_meses: catalog.period,
        legal_basis: `NR-${nr}`,
      });
    }
  }

  // ── 2. Exames Obrigatórios ──
  const exames: ExameObrigatorio[] = [
    {
      tipo: 'admissional',
      descricao: 'ASO Admissional',
      periodicidade_meses: null,
      legal_basis: 'NR-7, item 7.5.3 / CLT Art. 168',
      deadline_days: 0,
    },
    {
      tipo: 'periodico',
      descricao: 'ASO Periódico',
      periodicidade_meses: input.grau_risco >= 3 ? 12 : 24,
      legal_basis: 'NR-7, item 7.5.7',
      deadline_days: 0,
    },
  ];

  // Audiometria for noise risk
  if (input.risk_agents.some(a => a.toLowerCase().includes('ruido') || a.toLowerCase().includes('ruído'))) {
    exames.push({
      tipo: 'admissional',
      descricao: 'Audiometria tonal (exposição a ruído)',
      periodicidade_meses: 12,
      legal_basis: 'NR-7, Anexo I',
      deadline_days: 0,
    });
  }

  // Specific exams for chemical/biological agents
  if (input.risk_agents.some(a => a.toLowerCase().includes('quimico') || a.toLowerCase().includes('químico'))) {
    exames.push({
      tipo: 'periodico',
      descricao: 'Hemograma + função hepática/renal (exposição química)',
      periodicidade_meses: 12,
      legal_basis: 'NR-7',
      deadline_days: 0,
    });
  }

  // ── 3. EPIs Obrigatórios ──
  const epis: EpiObrigatorio[] = [];
  const addedCategories = new Set<string>();

  // Universal: capacete e calçado for grau_risco >= 2
  if (input.grau_risco >= 2) {
    epis.push({ categoria: 'Capacete', descricao: 'Capacete de segurança classe A ou B', ca_required: true, legal_basis: 'NR-6' });
    epis.push({ categoria: 'Calçado de Segurança', descricao: 'Calçado de segurança com solado antiderrapante', ca_required: true, legal_basis: 'NR-6' });
    addedCategories.add('Capacete');
    addedCategories.add('Calçado de Segurança');
  }

  // Risk-agent-specific EPIs
  for (const agent of input.risk_agents) {
    const normalized = agent.toLowerCase()
      .replace(/í/g, 'i').replace(/ú/g, 'u').replace(/é/g, 'e').replace(/ó/g, 'o').replace(/â/g, 'a');
    const epiList = EPI_BY_RISK[normalized] ?? [];
    for (const epi of epiList) {
      if (!addedCategories.has(epi.categoria)) {
        epis.push({ categoria: epi.categoria, descricao: epi.descricao, ca_required: true, legal_basis: 'NR-6' });
        addedCategories.add(epi.categoria);
      }
    }
  }

  // ── 4. Adicionais Legais ──
  const adicionais: AdicionalLegal[] = [];

  if (input.adicional_insalubridade && input.grau_insalubridade) {
    const rate = INSALUBRIDADE_RATES[input.grau_insalubridade];
    adicionais.push({
      tipo: 'insalubridade',
      percentual: rate * 100,
      base_calculo: 'salario_minimo',
      grau: input.grau_insalubridade,
      legal_basis: 'CLT Art. 192 / NR-15',
      valor_estimado: Math.round(NATIONAL_MINIMUM_WAGE * rate * 100) / 100,
    });
  }

  if (input.adicional_periculosidade) {
    adicionais.push({
      tipo: 'periculosidade',
      percentual: PERICULOSIDADE_RATE * 100,
      base_calculo: 'salario_base',
      legal_basis: 'CLT Art. 193 / NR-16',
      valor_estimado: Math.round(input.salario_proposto * PERICULOSIDADE_RATE * 100) / 100,
    });
  }

  // ── 5. Piso Salarial ──
  const pisoValor = Math.max(input.cct_salary_floor ?? 0, NATIONAL_MINIMUM_WAGE);
  const piso: PisoSalarialAplicavel = {
    valor: pisoValor,
    fonte: (input.cct_salary_floor && input.cct_salary_floor > NATIONAL_MINIMUM_WAGE)
      ? 'cct' : 'salario_minimo_nacional',
    vigencia: input.cct_vigencia,
    sindicato: input.cct_sindicato,
  };

  // Salary compliance check
  if (input.salario_proposto < pisoValor) {
    blockers.push(blocker('SALARY_BELOW_FLOOR',
      `Salário proposto (R$ ${input.salario_proposto.toFixed(2)}) abaixo do piso (R$ ${pisoValor.toFixed(2)})`,
      'CLT Art. 7, IV / CF Art. 7, IV'));
  }

  // ── Training hours estimate ──
  const trainingHours = nrs
    .filter(n => n.training_required)
    .reduce((acc, n) => acc + (n.nr_number === 35 || n.nr_number === 33 ? 40 : n.nr_number === 10 ? 40 : 8), 0);

  return {
    valid: blockers.length === 0,
    blockers,
    nrs_obrigatorias: nrs,
    exames_obrigatorios: exames,
    epis_obrigatorios: epis,
    adicionais_legais: adicionais,
    piso_salarial: piso,
    grau_risco: input.grau_risco,
    total_training_hours_estimated: trainingHours,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Apply Etapa 2 results to workflow.
 */
export function applyAnaliseLegalToWorkflow(
  workflow: HiringWorkflow,
  input: AnaliseLegalCargoInput,
): { workflow: HiringWorkflow; result: AnaliseLegalCargoResult } {
  const result = analyzePositionLegal(input);
  const now = new Date().toISOString();

  const positionStep = workflow.steps.find(s => s.step === 'position_mapping')!;
  const occStep = workflow.steps.find(s => s.step === 'occupational_profile')!;

  if (result.valid) {
    // Mark both position_mapping and occupational_profile as completed
    positionStep.status = 'completed';
    positionStep.completed_at = now;
    positionStep.metadata = {
      cbo_code: input.cbo_code,
      cnae_code: input.cnae_code,
      grau_risco: input.grau_risco,
      nrs_count: result.nrs_obrigatorias.length,
      exames_count: result.exames_obrigatorios.length,
      epis_count: result.epis_obrigatorios.length,
      adicionais_count: result.adicionais_legais.length,
      piso_salarial: result.piso_salarial.valor,
    };

    occStep.status = 'completed';
    occStep.completed_at = now;
    occStep.metadata = {
      applicable_nrs: result.nrs_obrigatorias.map(n => n.nr_number),
      risk_agents: input.risk_agents,
      training_hours: result.total_training_hours_estimated,
    };

    // Advance to contract_setup
    workflow.current_step = 'contract_setup';
    workflow.status = 'validation';
    const contractStep = workflow.steps.find(s => s.step === 'contract_setup')!;
    contractStep.status = 'in_progress';
    contractStep.started_at = now;
  } else {
    positionStep.status = 'blocked';
    positionStep.error_message = result.blockers.map(b => b.message).join('; ');
    workflow.status = 'blocked';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
