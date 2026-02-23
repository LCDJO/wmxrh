/**
 * Automated Hiring Workflow — Integration Adapters
 *
 * Thin adapter functions that bridge the hiring workflow
 * with other bounded contexts. Each returns a normalized
 * result without leaking external domain types.
 */
import type { OccupationalProfileResult, HealthExamRequirement } from './types';

// ═══════════════════════════════════════════════
//  Occupational Intelligence Adapter
// ═══════════════════════════════════════════════

export function buildOccupationalProfile(
  cnaeCode: string,
  cboCode: string | null,
): OccupationalProfileResult {
  // Defer to occupational-intelligence at runtime
  try {
    const { occupationalIntelligenceService } = require('@/domains/occupational-intelligence');
    const result = occupationalIntelligenceService.analyze({ cnae_code: cnaeCode });
    const profile = result.cnae_profile;

    return {
      cnae_code: cnaeCode,
      grau_risco: profile.cnae.grau_risco,
      cbo_code: cboCode,
      applicable_nrs: profile.applicable_nrs.map((nr: any) => nr.nr_number),
      requires_sesmt: profile.cnae.requires_sesmt,
      requires_cipa: profile.cnae.requires_cipa,
      required_epi_categories: profile.training_requirements
        .filter((t: any) => t.category === 'epi')
        .map((t: any) => t.name),
      required_trainings: profile.training_requirements.map((t: any) => t.name),
      risk_agents: profile.risk_categories.map((r: any) => r.name ?? r.category),
    };
  } catch {
    return {
      cnae_code: cnaeCode,
      grau_risco: 1,
      cbo_code: cboCode,
      applicable_nrs: [],
      requires_sesmt: false,
      requires_cipa: false,
      required_epi_categories: [],
      required_trainings: [],
      risk_agents: [],
    };
  }
}

// ═══════════════════════════════════════════════
//  Health Exam Adapter (PCMSO / NR-7)
// ═══════════════════════════════════════════════

export function getAdmissionalExamRequirements(grauRisco: number): HealthExamRequirement[] {
  const requirements: HealthExamRequirement[] = [
    {
      exam_type: 'admissional',
      description: 'Exame Médico Admissional (ASO)',
      legal_basis: 'NR-7, item 7.5.3 / CLT Art. 168',
      deadline_days: 0, // Must be done BEFORE starting work
    },
  ];

  if (grauRisco >= 3) {
    requirements.push({
      exam_type: 'admissional',
      description: 'Audiometria (grau de risco ≥ 3)',
      legal_basis: 'NR-7, Anexo I',
      deadline_days: 0,
    });
  }

  return requirements;
}

// ═══════════════════════════════════════════════
//  eSocial Adapter (S-2200)
// ═══════════════════════════════════════════════

export interface ESocialS2200Payload {
  cpf: string;
  name: string;
  birth_date: string;
  gender: string;
  cbo_code: string;
  hire_date: string;
  salary: number;
  work_schedule: string;
  contract_type: string;
  address: Record<string, unknown>;
  documents: Record<string, unknown>;
}

export function buildS2200Payload(data: ESocialS2200Payload) {
  return {
    event_type: 'S-2200' as const,
    layout_version: 'S-1.2' as const,
    payload: {
      cpfTrab: data.cpf,
      nmTrab: data.name,
      dtNascto: data.birth_date,
      sexo: data.gender === 'M' ? 1 : 2,
      codCBO: data.cbo_code.replace(/[^0-9]/g, ''),
      dtAdm: data.hire_date,
      vrSalFx: data.salary,
      tpJornada: data.work_schedule,
      tpContr: data.contract_type === 'indeterminado' ? 1 : 2,
      endereco: data.address,
      documentos: data.documents,
    },
  };
}

// ═══════════════════════════════════════════════
//  Safety Automation Adapter
// ═══════════════════════════════════════════════

export interface OnboardingSafetySignal {
  signal_type: 'new_admission';
  employee_id: string;
  tenant_id: string;
  grau_risco: number;
  applicable_nrs: number[];
  risk_agents: string[];
}

export function buildOnboardingSafetySignal(
  employeeId: string,
  tenantId: string,
  profile: OccupationalProfileResult,
): OnboardingSafetySignal {
  return {
    signal_type: 'new_admission',
    employee_id: employeeId,
    tenant_id: tenantId,
    grau_risco: profile.grau_risco,
    applicable_nrs: profile.applicable_nrs,
    risk_agents: profile.risk_agents,
  };
}
