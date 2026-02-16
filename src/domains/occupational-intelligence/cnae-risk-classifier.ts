/**
 * CNAE Risk Classifier Engine
 *
 * Maps CNAE codes to occupational risk grades (NR-4),
 * SESMT/CIPA requirements, and risk category probabilities.
 */

import type {
  CnaeInfo,
  GrauRisco,
  RiskCategoryMapping,
  OccupationalRiskType,
} from './types';

// ─── Static CNAE → Grau de Risco (NR-4 Quadro I, principais divisões) ───

const CNAE_DIVISION_RISK: Record<string, GrauRisco> = {
  // Agropecuária
  '01': 3, '02': 3, '03': 3,
  // Indústria extrativa
  '05': 4, '06': 4, '07': 4, '08': 4, '09': 3,
  // Indústria de transformação
  '10': 3, '11': 3, '12': 3, '13': 3, '14': 2, '15': 3,
  '16': 3, '17': 3, '18': 2, '19': 3, '20': 3, '21': 2,
  '22': 3, '23': 4, '24': 4, '25': 3, '26': 2, '27': 3,
  '28': 3, '29': 3, '30': 3, '31': 3, '32': 2, '33': 3,
  // Eletricidade e gás
  '35': 3,
  // Água e esgoto
  '36': 3, '37': 3, '38': 3, '39': 3,
  // Construção
  '41': 3, '42': 4, '43': 3,
  // Comércio
  '45': 2, '46': 2, '47': 2,
  // Transporte
  '49': 3, '50': 3, '51': 3, '52': 3, '53': 2,
  // Alojamento e alimentação
  '55': 2, '56': 2,
  // Informação e comunicação
  '58': 1, '59': 2, '60': 1, '61': 2, '62': 1, '63': 1,
  // Financeiro
  '64': 1, '65': 1, '66': 1,
  // Imobiliário
  '68': 1,
  // Atividades profissionais / científicas
  '69': 1, '70': 1, '71': 2, '72': 1, '73': 1, '74': 1, '75': 1,
  // Administrativo
  '77': 1, '78': 2, '79': 1, '80': 3, '81': 2, '82': 1,
  // Administração pública
  '84': 2,
  // Educação
  '85': 1,
  // Saúde
  '86': 3, '87': 3, '88': 2,
  // Artes / Cultura
  '90': 2, '91': 1, '92': 2, '93': 2,
  // Serviços pessoais
  '94': 1, '95': 2, '96': 2, '97': 1,
  // Organismos internacionais
  '99': 1,
};

// ─── Risk category probability by grau de risco ───

const RISK_PROFILE_BY_GRAU: Record<GrauRisco, Omit<RiskCategoryMapping, 'mitigation_nrs'>[]> = {
  1: [
    { risk_type: 'ergonomico', probability: 0.6, typical_agents: ['postura inadequada', 'repetitividade'] },
    { risk_type: 'acidente', probability: 0.2, typical_agents: ['queda de mesmo nível'] },
  ],
  2: [
    { risk_type: 'ergonomico', probability: 0.7, typical_agents: ['postura inadequada', 'repetitividade', 'esforço físico'] },
    { risk_type: 'acidente', probability: 0.4, typical_agents: ['queda', 'choque elétrico'] },
    { risk_type: 'fisico', probability: 0.3, typical_agents: ['ruído', 'iluminação'] },
  ],
  3: [
    { risk_type: 'fisico', probability: 0.7, typical_agents: ['ruído', 'vibração', 'calor'] },
    { risk_type: 'quimico', probability: 0.5, typical_agents: ['poeiras', 'vapores', 'solventes'] },
    { risk_type: 'ergonomico', probability: 0.6, typical_agents: ['levantamento de peso', 'postura forçada'] },
    { risk_type: 'acidente', probability: 0.6, typical_agents: ['máquinas', 'queda de altura', 'eletricidade'] },
    { risk_type: 'biologico', probability: 0.3, typical_agents: ['bactérias', 'fungos'] },
  ],
  4: [
    { risk_type: 'fisico', probability: 0.9, typical_agents: ['ruído extremo', 'vibração', 'radiação', 'calor'] },
    { risk_type: 'quimico', probability: 0.8, typical_agents: ['poeiras minerais', 'gases tóxicos', 'produtos químicos'] },
    { risk_type: 'biologico', probability: 0.5, typical_agents: ['bactérias', 'parasitas'] },
    { risk_type: 'ergonomico', probability: 0.7, typical_agents: ['esforço extremo', 'postura forçada'] },
    { risk_type: 'acidente', probability: 0.9, typical_agents: ['explosão', 'soterramento', 'queda de altura', 'máquinas pesadas'] },
  ],
};

const NR_BY_RISK_TYPE: Record<OccupationalRiskType, number[]> = {
  fisico: [9, 15],
  quimico: [9, 15, 20],
  biologico: [9, 15, 32],
  ergonomico: [17],
  acidente: [6, 10, 11, 12, 18, 33, 35],
};

// ─── Public API ───

export function parseCnaeDivision(cnaeCode: string): string {
  return cnaeCode.replace(/[.\-\/]/g, '').substring(0, 2);
}

export function classifyCnae(cnaeCode: string, description?: string): CnaeInfo {
  const cleaned = cnaeCode.replace(/[.\-\/]/g, '');
  const division = cleaned.substring(0, 2);
  const group = cleaned.substring(0, 3);
  const grau = CNAE_DIVISION_RISK[division] ?? 2;

  return {
    code: cnaeCode,
    description: description ?? `CNAE ${cnaeCode}`,
    division,
    group,
    grau_risco: grau as GrauRisco,
    requires_sesmt: grau >= 3,
    requires_cipa: true, // NR-5: toda empresa com empregados
  };
}

export function mapRiskCategories(grau: GrauRisco): RiskCategoryMapping[] {
  const base = RISK_PROFILE_BY_GRAU[grau] ?? RISK_PROFILE_BY_GRAU[2];
  return base.map(entry => ({
    ...entry,
    mitigation_nrs: NR_BY_RISK_TYPE[entry.risk_type] ?? [],
  }));
}

export function getGrauRiscoLabel(grau: GrauRisco): string {
  const labels: Record<GrauRisco, string> = {
    1: 'Baixo',
    2: 'Médio',
    3: 'Alto',
    4: 'Muito Alto',
  };
  return labels[grau];
}
