/**
 * Compliance Validation Service
 *
 * Validates employee master record data before activation and
 * generates alerts for non-conformities.
 *
 * Rules:
 * 1. Block activation without admissional exam
 * 2. Block activation without valid CBO
 * 3. Alert salary below floor
 * 4. Validate jornada matches contract
 * 5. Validate eSocial category compatibility
 */

import type { EmployeeMasterRecord, ContractType } from './types';

// ── Validation Result ──

export type ValidationSeverity = 'blocker' | 'warning' | 'info';

export interface ComplianceValidationItem {
  code: string;
  severity: ValidationSeverity;
  message: string;
  legal_basis?: string;
}

export interface ComplianceValidationResult {
  valid: boolean;
  canActivate: boolean;
  items: ComplianceValidationItem[];
}

// ── CBO validation ──

const CBO_PATTERN = /^\d{4}-?\d{2}$/;

function isValidCBO(cbo: string | null | undefined): boolean {
  if (!cbo) return false;
  return CBO_PATTERN.test(cbo.trim());
}

// ── eSocial category ↔ contract type compatibility ──

const ESOCIAL_CONTRACT_MAP: Record<string, ContractType[]> = {
  '101': ['clt_indeterminado'],
  '102': ['clt_determinado'],
  '103': ['clt_indeterminado', 'clt_determinado'],
  '104': ['clt_indeterminado'],
  '105': ['clt_aprendiz'],
  '106': ['clt_determinado', 'clt_temporario'],
  '111': ['clt_intermitente'],
  '201': ['autonomo'],
  '301': ['estagio'],
  '302': ['estagio'],
};

function isEsocialCategoryCompatible(
  category: string | null | undefined,
  contractType: ContractType | null | undefined,
): boolean {
  if (!category || !contractType) return true; // skip if either is missing
  const allowed = ESOCIAL_CONTRACT_MAP[category];
  if (!allowed) return true; // unknown category, don't block
  return allowed.includes(contractType);
}

// ── Service ──

export const complianceValidationService = {
  /**
   * Validate an employee master record for activation readiness.
   *
   * @param record - Full master record (aggregated)
   * @param exams  - Health exams for the employee (from PCMSO)
   * @param pisoSalarial - Minimum salary floor (from CCT or legal minimum)
   */
  validate(
    record: EmployeeMasterRecord,
    exams: any[],
    pisoSalarial?: number,
  ): ComplianceValidationResult {
    const items: ComplianceValidationItem[] = [];

    const currentContract = record.contracts
      .filter(c => !c.deleted_at)
      .sort((a, b) => b.admission_date.localeCompare(a.admission_date))[0] ?? null;

    // 1. Block: no admissional exam
    const hasAdmissional = exams.some(
      (e) =>
        (e.exam_type === 'admissional' || e.tipo_exame === 'admissional') &&
        (e.result || e.status === 'realizado'),
    );
    if (!hasAdmissional) {
      items.push({
        code: 'NO_ADMISSIONAL_EXAM',
        severity: 'blocker',
        message: 'Exame admissional não realizado. Ativação bloqueada.',
        legal_basis: 'NR-7 / CLT Art. 168',
      });
    }

    // 2. Block: no valid CBO
    const cbo = currentContract?.cbo_code;
    if (!isValidCBO(cbo)) {
      items.push({
        code: 'INVALID_CBO',
        severity: 'blocker',
        message: 'CBO ausente ou inválido. Necessário para eSocial S-2200.',
        legal_basis: 'eSocial S-2200 / CBO-MTE',
      });
    }

    // 3. Warning: salary below floor
    if (pisoSalarial && currentContract?.salario_base != null) {
      const salary = Number(currentContract.salario_base);
      if (salary > 0 && salary < pisoSalarial) {
        items.push({
          code: 'SALARY_BELOW_FLOOR',
          severity: 'warning',
          message: `Salário R$ ${salary.toFixed(2)} está abaixo do piso R$ ${pisoSalarial.toFixed(2)}.`,
          legal_basis: 'CLT Art. 7º / CCT vigente',
        });
      }
    }

    // 4. Warning: jornada vs contract type
    if (currentContract) {
      const weeklyHours = currentContract.weekly_hours ?? 44;
      const jornadaTipo = (currentContract as any).jornada_tipo;

      if (jornadaTipo === 'parcial' && weeklyHours > 30) {
        items.push({
          code: 'JORNADA_MISMATCH',
          severity: 'warning',
          message: `Jornada parcial com ${weeklyHours}h/sem excede limite de 30h (CLT Art. 58-A).`,
          legal_basis: 'CLT Art. 58-A',
        });
      }
      if (jornadaTipo === 'integral' && weeklyHours > 44) {
        items.push({
          code: 'JORNADA_EXCEEDS_MAX',
          severity: 'warning',
          message: `Jornada de ${weeklyHours}h/sem excede limite legal de 44h.`,
          legal_basis: 'CLT Art. 7º, XIII / CF Art. 7º',
        });
      }
    }

    // 5. Warning: eSocial category vs contract type
    if (currentContract?.esocial_category && currentContract.contract_type) {
      if (!isEsocialCategoryCompatible(currentContract.esocial_category, currentContract.contract_type)) {
        items.push({
          code: 'ESOCIAL_CATEGORY_MISMATCH',
          severity: 'warning',
          message: `Categoria eSocial "${currentContract.esocial_category}" incompatível com tipo de contrato "${currentContract.contract_type}".`,
          legal_basis: 'eSocial Tabela 01 / Leiaute S-2200',
        });
      }
    }

    const hasBlocker = items.some(i => i.severity === 'blocker');

    return {
      valid: items.length === 0,
      canActivate: !hasBlocker,
      items,
    };
  },
};
