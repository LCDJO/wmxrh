/**
 * Automated Hiring — Etapa 7: Integração Fleet (Condicional)
 *
 * Validates fleet compliance requirements for positions involving vehicles.
 * This step is SKIPPED if the position does not involve vehicle usage.
 *
 * When applicable, validates:
 * - Valid CNH (driver's license) with correct category
 * - Fleet device binding (GPS tracker assignment)
 * - Mandatory fleet agreements signed (vehicle use, fines, GPS monitoring)
 *
 * Integrations:
 * - Fleet Compliance Engine (device registry, behavioral score)
 * - Employee Agreement Engine (vehicle/GPS/fines terms)
 * - Traccar Integration (device provisioning)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type CnhCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'AB' | 'AC' | 'AD' | 'AE';

export interface CnhData {
  numero_registro: string;
  categoria: CnhCategory;
  data_validade: string;
  data_primeira_habilitacao: string;
  has_ear_restriction: boolean;
  has_monocular_restriction: boolean;
  exercicio_atividade_remunerada: boolean;
}

export interface FleetDeviceBinding {
  device_serial: string;
  device_type: 'gps_tracker' | 'obd2' | 'celular';
  vehicle_plate: string | null;
  bound: boolean;
  bound_at: string | null;
}

export interface FleetAgreementStatus {
  termo_veiculo_signed: boolean;
  termo_multas_signed: boolean;
  termo_gps_signed: boolean;
}

export interface FleetEtapaInput {
  /** Whether this position requires vehicle */
  requires_vehicle: boolean;
  /** Minimum CNH category required for the position */
  required_cnh_category: CnhCategory | null;
  /** CNH data provided by candidate */
  cnh: CnhData | null;
  /** Device binding status */
  device: FleetDeviceBinding | null;
  /** Fleet agreement signatures */
  agreements: FleetAgreementStatus;
}

export interface FleetEtapaResult {
  valid: boolean;
  skipped: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  cnh_valid: boolean;
  device_bound: boolean;
  agreements_complete: boolean;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  CNH Category Hierarchy
// ═══════════════════════════════════════════════

const CNH_HIERARCHY: Record<CnhCategory, number> = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5,
  'AB': 6, 'AC': 7, 'AD': 8, 'AE': 9,
};

export function cnhCategorySatisfies(has: CnhCategory, requires: CnhCategory): boolean {
  // Combined categories (AB, AC, etc.) satisfy both components
  if (has === requires) return true;
  if (has.includes(requires)) return true;
  // Higher solo categories satisfy lower: E > D > C > B
  const soloCategories = ['B', 'C', 'D', 'E'];
  const hasIdx = soloCategories.indexOf(has);
  const reqIdx = soloCategories.indexOf(requires);
  if (hasIdx >= 0 && reqIdx >= 0 && hasIdx >= reqIdx) return true;
  // Combined with higher component
  for (const ch of has) {
    const chIdx = soloCategories.indexOf(ch);
    if (chIdx >= 0 && chIdx >= reqIdx) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'activation' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'activation' };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Validate fleet compliance for admission.
 */
export function validateFleetCompliance(input: FleetEtapaInput): FleetEtapaResult {
  const now = new Date().toISOString();

  // Skip if position doesn't require vehicle
  if (!input.requires_vehicle) {
    return {
      valid: true,
      skipped: true,
      blockers: [],
      warnings: [],
      cnh_valid: true,
      device_bound: true,
      agreements_complete: true,
      evaluated_at: now,
    };
  }

  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  // ── 1. CNH Validation ──
  let cnhValid = false;

  if (!input.cnh) {
    blockers.push(mkBlocker(
      'CNH_MISSING',
      'CNH não informada — obrigatória para cargos com veículo',
      'CTB Art. 159',
    ));
  } else {
    // Expiry check
    const expiryDate = new Date(input.cnh.data_validade);
    const today = new Date();
    if (expiryDate <= today) {
      blockers.push(mkBlocker(
        'CNH_EXPIRED',
        `CNH vencida em ${input.cnh.data_validade} — renovação obrigatória`,
        'CTB Art. 159, §1º',
      ));
    } else {
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) {
        warnings.push(mkWarning(
          'CNH_EXPIRING_SOON',
          `CNH vence em ${daysUntilExpiry} dias — providenciar renovação`,
          'CTB Art. 159',
        ));
      }
    }

    // Category check
    if (input.required_cnh_category && !cnhCategorySatisfies(input.cnh.categoria, input.required_cnh_category)) {
      blockers.push(mkBlocker(
        'CNH_CATEGORY_INSUFFICIENT',
        `CNH categoria ${input.cnh.categoria} insuficiente — cargo exige categoria ${input.required_cnh_category}`,
        'CTB Art. 143',
      ));
    }

    // EAR (Exercício de Atividade Remunerada) — required for professional drivers
    if (!input.cnh.exercicio_atividade_remunerada) {
      warnings.push(mkWarning(
        'CNH_NO_EAR',
        'CNH sem anotação de EAR (Exercício de Atividade Remunerada) — obrigatório para motoristas profissionais',
        'CTB Art. 145',
      ));
    }

    cnhValid = blockers.filter(b => b.code.startsWith('CNH_')).length === 0;
  }

  // ── 2. Device Binding ──
  let deviceBound = false;

  if (!input.device) {
    warnings.push(mkWarning(
      'FLEET_NO_DEVICE',
      'Dispositivo de rastreamento não vinculado — vincular antes do início das atividades',
    ));
  } else if (!input.device.bound) {
    warnings.push(mkWarning(
      'FLEET_DEVICE_NOT_BOUND',
      `Dispositivo ${input.device.device_serial} cadastrado mas não vinculado`,
    ));
  } else {
    deviceBound = true;
  }

  // ── 3. Fleet Agreements ──
  let agreementsComplete = true;

  if (!input.agreements.termo_veiculo_signed) {
    blockers.push(mkBlocker(
      'FLEET_TERM_VEHICLE_MISSING',
      'Termo de Responsabilidade — Uso de Veículo não assinado',
      'CC Art. 462 / Política Interna',
    ));
    agreementsComplete = false;
  }

  if (!input.agreements.termo_multas_signed) {
    blockers.push(mkBlocker(
      'FLEET_TERM_FINES_MISSING',
      'Termo de Responsabilidade — Multas de Trânsito não assinado',
      'CTB Art. 257',
    ));
    agreementsComplete = false;
  }

  if (!input.agreements.termo_gps_signed) {
    blockers.push(mkBlocker(
      'FLEET_TERM_GPS_MISSING',
      'Termo de Ciência — Monitoramento GPS não assinado',
      'LGPD Art. 7º, V',
    ));
    agreementsComplete = false;
  }

  return {
    valid: blockers.length === 0,
    skipped: false,
    blockers,
    warnings,
    cnh_valid: cnhValid,
    device_bound: deviceBound,
    agreements_complete: agreementsComplete,
    evaluated_at: now,
  };
}

/**
 * Apply Fleet Etapa to workflow. Runs between agreements and compliance_gate.
 * If not applicable, auto-completes.
 */
export function applyFleetComplianceToWorkflow(
  workflow: HiringWorkflow,
  input: FleetEtapaInput,
): { workflow: HiringWorkflow; result: FleetEtapaResult } {
  const result = validateFleetCompliance(input);
  const now = new Date().toISOString();

  // Fleet validation is embedded in the compliance_gate step metadata
  // since there's no dedicated fleet step in the workflow
  const complianceStep = workflow.steps.find(s => s.step === 'compliance_gate')!;

  if (result.valid) {
    complianceStep.metadata = {
      ...complianceStep.metadata,
      fleet_validated: true,
      fleet_skipped: result.skipped,
      fleet_cnh_valid: result.cnh_valid,
      fleet_device_bound: result.device_bound,
      fleet_agreements_complete: result.agreements_complete,
      fleet_validated_at: now,
    };
  } else {
    complianceStep.metadata = {
      ...complianceStep.metadata,
      fleet_validated: false,
      fleet_blockers: result.blockers.map(b => b.message),
    };

    // If fleet has blockers, block the compliance gate
    if (complianceStep.status === 'in_progress') {
      complianceStep.status = 'blocked';
      complianceStep.error_message = result.blockers.map(b => b.message).join('; ');
    }

    workflow.status = 'blocked';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
