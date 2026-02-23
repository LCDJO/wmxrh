/**
 * Automated Hiring — Etapa 1: Pré-Cadastro
 *
 * Responsible for:
 * 1. Creating an EmployeeRecord with status = 'pre_admissao'
 * 2. Running mandatory validations (CPF, PIS, CBO, eSocial category)
 * 3. Blocking workflow advancement if validation fails
 *
 * Integrations:
 * - Employee Master Record Engine (employee creation)
 * - Career & Legal Intelligence Engine (CBO validation)
 * - eSocial Engine (category validation)
 */

import { isValidCPF, isValidPIS } from './document-validators';
import type { ComplianceBlocker, HiringWorkflow } from './types';

// ═══════════════════════════════════════════════
//  eSocial Worker Categories (Categoria do Trabalhador)
// ═══════════════════════════════════════════════

export const ESOCIAL_CATEGORIES = {
  '101': 'Empregado - Geral',
  '102': 'Empregado - Trabalhador Rural por Prazo Determinado',
  '103': 'Empregado - Aprendiz',
  '104': 'Empregado - Doméstico',
  '105': 'Empregado - Contrato a Termo (CLT)',
  '106': 'Empregado - Contrato por Prazo Determinado (Lei 9.601/98)',
  '111': 'Empregado - Contrato Intermitente',
  '201': 'Trabalhador Avulso Portuário',
  '202': 'Trabalhador Avulso Não Portuário',
  '301': 'Servidor Público - Estatutário',
  '302': 'Servidor Público - Exercício de Mandato Eletivo',
  '303': 'Servidor Público - Cargo em Comissão',
  '305': 'Servidor Público - Contratação Temporária',
  '306': 'Servidor Público - Agente Político',
  '401': 'Dirigente Sindical',
  '410': 'Trabalhador Cedido',
  '701': 'Contribuinte Individual - Autônomo Geral',
  '711': 'Contribuinte Individual - Cooperado',
  '712': 'Contribuinte Individual - Transportador Cooperado',
  '721': 'Contribuinte Individual - Diretor com FGTS',
  '722': 'Contribuinte Individual - Diretor sem FGTS',
  '723': 'Contribuinte Individual - Empresário/Sócio',
  '731': 'Contribuinte Individual - Cooperado Filiado a Cooperativa de Produção',
  '734': 'Contribuinte Individual - Microempreendedor Individual',
  '738': 'Contribuinte Individual - MEI com Contratação de Empregado',
  '741': 'Contribuinte Individual - Médico Residente',
  '751': 'Contribuinte Individual - Atleta Profissional',
  '771': 'Contribuinte Individual - Membro de Conselho Tutelar',
  '901': 'Estagiário',
  '902': 'Médico Residente',
  '903': 'Bolsista',
  '904': 'Participante de curso de formação (regime próprio)',
  '905': 'Adolescente sob guarda',
} as const;

export type ESocialCategoryCode = keyof typeof ESOCIAL_CATEGORIES;

export function isValidESocialCategory(code: string): boolean {
  return code in ESOCIAL_CATEGORIES;
}

export function getESocialCategoryLabel(code: string): string | null {
  return (ESOCIAL_CATEGORIES as Record<string, string>)[code] ?? null;
}

// ═══════════════════════════════════════════════
//  CBO Validation
// ═══════════════════════════════════════════════

/**
 * Basic CBO format validation.
 * CBO code must be 6 digits (format: XXXX-XX or XXXXXX).
 */
export function isValidCBOFormat(cbo: string): boolean {
  const digits = cbo.replace(/\D/g, '');
  return digits.length === 6;
}

// ═══════════════════════════════════════════════
//  Pre-Cadastro Input & Result
// ═══════════════════════════════════════════════

export interface PreCadastroInput {
  candidate_name: string;
  cpf: string;
  pis_pasep: string;
  cbo_code: string;
  esocial_category: string;
  birth_date: string;
  gender: 'M' | 'F';
  /** Additional optional fields */
  email?: string;
  phone?: string;
  nationality?: string;
}

export interface PreCadastroResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  /** If valid, the employee_id that would be created */
  employee_record_status: 'pre_admissao';
}

// ═══════════════════════════════════════════════
//  Pre-Cadastro Validation Engine
// ═══════════════════════════════════════════════

function blocker(code: string, message: string, legalBasis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message, legal_basis: legalBasis ?? null, step: 'personal_data' };
}

function warning(code: string, message: string, legalBasis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message, legal_basis: legalBasis ?? null, step: 'personal_data' };
}

/**
 * Validate all pre-cadastro fields.
 * Returns blockers that prevent workflow advancement.
 */
export function validatePreCadastro(input: PreCadastroInput): PreCadastroResult {
  const blockers: ComplianceBlocker[] = [];

  // 1. Nome
  if (!input.candidate_name || input.candidate_name.trim().length < 3) {
    blockers.push(blocker('INVALID_NAME', 'Nome completo deve ter pelo menos 3 caracteres', 'CLT Art. 29'));
  }

  // 2. CPF
  if (!input.cpf || !isValidCPF(input.cpf)) {
    blockers.push(blocker('INVALID_CPF', 'CPF inválido — verifique os dígitos verificadores', 'IN RFB 1.548/2015'));
  }

  // 3. PIS/PASEP
  if (!input.pis_pasep || !isValidPIS(input.pis_pasep)) {
    blockers.push(blocker('INVALID_PIS', 'PIS/PASEP inválido — verifique os dígitos verificadores', 'Lei 7.998/90'));
  }

  // 4. CBO
  if (!input.cbo_code) {
    blockers.push(blocker('MISSING_CBO', 'CBO é obrigatório para registro e eSocial S-2200', 'Portaria MTE 397/2002'));
  } else if (!isValidCBOFormat(input.cbo_code)) {
    blockers.push(blocker('INVALID_CBO_FORMAT', 'CBO deve ter 6 dígitos (ex: 411010)', 'Portaria MTE 397/2002'));
  }

  // 5. Categoria eSocial
  if (!input.esocial_category) {
    blockers.push(blocker('MISSING_ESOCIAL_CATEGORY', 'Categoria do trabalhador eSocial é obrigatória', 'Layout S-2200'));
  } else if (!isValidESocialCategory(input.esocial_category)) {
    blockers.push(blocker('INVALID_ESOCIAL_CATEGORY',
      `Categoria eSocial "${input.esocial_category}" não é válida — consulte a tabela 01 do eSocial`, 'Layout S-2200'));
  }

  // 6. Data de nascimento
  if (!input.birth_date) {
    blockers.push(blocker('MISSING_BIRTH_DATE', 'Data de nascimento é obrigatória', 'CLT Art. 29'));
  } else {
    const birth = new Date(input.birth_date);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 14) {
      blockers.push(blocker('UNDERAGE', 'Idade mínima para trabalho é 14 anos (aprendiz)', 'CF Art. 7, XXXIII'));
    } else if (age < 16 && input.esocial_category !== '103') {
      blockers.push(blocker('UNDERAGE_NON_APPRENTICE',
        'Menores de 16 anos só podem ser contratados como aprendiz (categoria 103)', 'CLT Art. 403'));
    }
  }

  // 7. Sexo
  if (!input.gender || !['M', 'F'].includes(input.gender)) {
    blockers.push(blocker('MISSING_GENDER', 'Sexo é obrigatório para eSocial S-2200', 'Layout S-2200'));
  }

  return {
    valid: blockers.length === 0,
    blockers,
    employee_record_status: 'pre_admissao',
  };
}

/**
 * Apply pre-cadastro step to the hiring workflow.
 * Updates workflow status based on validation result.
 */
export function applyPreCadastroToWorkflow(
  workflow: HiringWorkflow,
  input: PreCadastroInput,
): { workflow: HiringWorkflow; result: PreCadastroResult } {
  const result = validatePreCadastro(input);
  const now = new Date().toISOString();

  const personalDataStep = workflow.steps.find(s => s.step === 'personal_data')!;

  if (result.valid) {
    personalDataStep.status = 'completed';
    personalDataStep.completed_at = now;
    personalDataStep.error_message = null;
    personalDataStep.metadata = {
      cpf: input.cpf,
      pis_pasep: input.pis_pasep,
      cbo_code: input.cbo_code,
      esocial_category: input.esocial_category,
      birth_date: input.birth_date,
      gender: input.gender,
      validated_at: now,
    };

    // Move to next step
    workflow.current_step = 'documents';
    workflow.status = 'validation';
    const docsStep = workflow.steps.find(s => s.step === 'documents')!;
    docsStep.status = 'in_progress';
    docsStep.started_at = now;
  } else {
    personalDataStep.status = 'blocked';
    personalDataStep.error_message = result.blockers.map(b => b.message).join('; ');
    workflow.status = 'blocked';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
