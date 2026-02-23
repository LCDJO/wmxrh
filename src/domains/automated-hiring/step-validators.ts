/**
 * Automated Hiring Workflow — Step Validators
 *
 * Pure validation functions per hiring step.
 * Each returns { valid, errors } without side effects.
 */
import type { HiringStep, ComplianceBlocker } from './types';
import { isValidCPF, isValidPIS } from './document-validators';
import { isValidCBOFormat, isValidESocialCategory } from './pre-cadastro.engine';

export interface StepValidationResult {
  valid: boolean;
  errors: ComplianceBlocker[];
}

type StepValidator = (payload: Record<string, unknown>) => StepValidationResult;

function ok(): StepValidationResult {
  return { valid: true, errors: [] };
}

function fail(blockers: ComplianceBlocker[]): StepValidationResult {
  return { valid: false, errors: blockers };
}

function blocker(step: HiringStep, code: string, message: string, legalBasis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message, legal_basis: legalBasis ?? null, step };
}

// ── Validators ──

const validatePersonalData: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.name) errors.push(blocker('personal_data', 'MISSING_NAME', 'Nome completo é obrigatório', 'CLT Art. 29'));
  if (!p.cpf) {
    errors.push(blocker('personal_data', 'MISSING_CPF', 'CPF é obrigatório', 'IN RFB 1.548/2015'));
  } else if (!isValidCPF(p.cpf as string)) {
    errors.push(blocker('personal_data', 'INVALID_CPF', 'CPF inválido — dígitos verificadores incorretos', 'IN RFB 1.548/2015'));
  }
  if (p.pis_pasep && !isValidPIS(p.pis_pasep as string)) {
    errors.push(blocker('personal_data', 'INVALID_PIS', 'PIS/PASEP inválido', 'Lei 7.998/90'));
  }
  if (p.cbo_code && !isValidCBOFormat(p.cbo_code as string)) {
    errors.push(blocker('personal_data', 'INVALID_CBO', 'CBO deve ter 6 dígitos', 'Portaria 397/2002'));
  }
  if (p.esocial_category && !isValidESocialCategory(p.esocial_category as string)) {
    errors.push(blocker('personal_data', 'INVALID_ESOCIAL_CAT', 'Categoria eSocial inválida', 'Layout S-2200'));
  }
  if (!p.birth_date) errors.push(blocker('personal_data', 'MISSING_BIRTH_DATE', 'Data de nascimento é obrigatória', 'CLT Art. 29'));
  if (!p.gender) errors.push(blocker('personal_data', 'MISSING_GENDER', 'Sexo é obrigatório para eSocial S-2200'));
  return errors.length ? fail(errors) : ok();
};

const validateDocuments: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.rg && !p.cnh) errors.push(blocker('documents', 'MISSING_ID_DOC', 'RG ou CNH obrigatório', 'CLT Art. 29'));
  if (!p.ctps_number) errors.push(blocker('documents', 'MISSING_CTPS', 'Número da CTPS é obrigatório', 'CLT Art. 13'));
  if (!p.pis_pasep) errors.push(blocker('documents', 'MISSING_PIS', 'PIS/PASEP é obrigatório', 'Lei 7.998/90'));
  return errors.length ? fail(errors) : ok();
};

const validateAddress: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.cep) errors.push(blocker('address', 'MISSING_CEP', 'CEP é obrigatório para eSocial'));
  if (!p.logradouro) errors.push(blocker('address', 'MISSING_LOGRADOURO', 'Logradouro é obrigatório'));
  if (!p.municipio) errors.push(blocker('address', 'MISSING_MUNICIPIO', 'Município é obrigatório'));
  if (!p.uf) errors.push(blocker('address', 'MISSING_UF', 'UF é obrigatório'));
  return errors.length ? fail(errors) : ok();
};

const validateDependents: StepValidator = () => ok(); // Optional step

const validatePositionMapping: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.position_id) errors.push(blocker('position_mapping', 'MISSING_POSITION', 'Cargo é obrigatório'));
  if (!p.cbo_code) errors.push(blocker('position_mapping', 'MISSING_CBO', 'CBO é obrigatório para eSocial', 'Portaria 397/2002'));
  return errors.length ? fail(errors) : ok();
};

const validateOccupationalProfile: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.cnae_code) errors.push(blocker('occupational_profile', 'MISSING_CNAE', 'CNAE da empresa é obrigatório', 'NR-4'));
  return errors.length ? fail(errors) : ok();
};

const validateContractSetup: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.hire_date) errors.push(blocker('contract_setup', 'MISSING_HIRE_DATE', 'Data de admissão é obrigatória', 'CLT Art. 29'));
  if (!p.salary) errors.push(blocker('contract_setup', 'MISSING_SALARY', 'Salário é obrigatório', 'CLT Art. 29'));
  if (!p.work_schedule) errors.push(blocker('contract_setup', 'MISSING_SCHEDULE', 'Jornada de trabalho é obrigatória', 'CLT Art. 58'));
  return errors.length ? fail(errors) : ok();
};

const validateHealthExam: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  if (!p.aso_admissional) errors.push(blocker('health_exam', 'MISSING_ASO', 'ASO admissional é obrigatório', 'NR-7 / CLT Art. 168'));
  if (p.aso_result === 'inapto') errors.push(blocker('health_exam', 'ASO_INAPTO', 'Colaborador considerado inapto no ASO admissional', 'NR-7'));
  return errors.length ? fail(errors) : ok();
};

const validateNrTraining: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  const required = (p.required_trainings as string[]) ?? [];
  const scheduled = (p.scheduled_trainings as string[]) ?? [];
  const missing = required.filter(t => !scheduled.includes(t));
  if (missing.length > 0) {
    errors.push(blocker('nr_training', 'MISSING_NR_TRAINING',
      `Treinamentos NR pendentes: ${missing.join(', ')}`, 'NR-1 item 1.7'));
  }
  return errors.length ? fail(errors) : ok();
};

const validateEpiAssignment: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  const required = (p.required_epis as string[]) ?? [];
  const delivered = (p.delivered_epis as string[]) ?? [];
  const missing = required.filter(e => !delivered.includes(e));
  if (missing.length > 0) {
    errors.push(blocker('epi_assignment', 'MISSING_EPI',
      `EPIs obrigatórios não entregues: ${missing.join(', ')}`, 'NR-6'));
  }
  return errors.length ? fail(errors) : ok();
};

const validateAgreements: StepValidator = (p) => {
  const errors: ComplianceBlocker[] = [];
  const required = (p.required_agreements as string[]) ?? [];
  const signed = (p.signed_agreements as string[]) ?? [];
  const missing = required.filter(a => !signed.includes(a));
  if (missing.length > 0) {
    errors.push(blocker('agreements', 'MISSING_AGREEMENT',
      `Termos obrigatórios pendentes de assinatura: ${missing.join(', ')}`));
  }
  return errors.length ? fail(errors) : ok();
};

const validateComplianceGate: StepValidator = () => ok(); // Evaluated by compliance-gate.ts
const validateEsocialSubmission: StepValidator = () => ok(); // Evaluated after submission
const validateActivation: StepValidator = () => ok();

// ── Registry ──

const VALIDATORS: Record<HiringStep, StepValidator> = {
  personal_data: validatePersonalData,
  documents: validateDocuments,
  address: validateAddress,
  dependents: validateDependents,
  position_mapping: validatePositionMapping,
  occupational_profile: validateOccupationalProfile,
  contract_setup: validateContractSetup,
  health_exam: validateHealthExam,
  nr_training: validateNrTraining,
  epi_assignment: validateEpiAssignment,
  agreements: validateAgreements,
  compliance_gate: validateComplianceGate,
  esocial_submission: validateEsocialSubmission,
  activation: validateActivation,
};

export function validateStep(step: HiringStep, payload: Record<string, unknown>): StepValidationResult {
  return VALIDATORS[step](payload);
}

export function validateAllSteps(payloads: Map<HiringStep, Record<string, unknown>>): StepValidationResult {
  const allErrors: ComplianceBlocker[] = [];
  for (const [step, payload] of payloads) {
    const result = VALIDATORS[step](payload);
    allErrors.push(...result.errors);
  }
  return allErrors.length ? fail(allErrors) : ok();
}
