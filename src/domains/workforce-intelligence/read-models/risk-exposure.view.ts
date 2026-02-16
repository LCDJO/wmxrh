/**
 * RiskExposureView — Read Model
 *
 * Flat projection of an employee's occupational risk exposures,
 * consumed by the Workforce Intelligence Engine for risk detection.
 */

export interface RiskExposureView {
  exposure_id: string;
  employee_id: string;
  employee_name?: string;
  risk_factor_name: string;
  risk_factor_category: string;
  risk_level: string;
  is_active: boolean;
  generates_hazard_pay: boolean;
  hazard_pay_type: string | null;
  hazard_pay_percentage: number | null;
  requires_epi: boolean;
  epi_description: string | null;
  start_date: string;
  end_date: string | null;
  exposure_group_name: string | null;
}

/** Build a RiskExposureView from raw employee_risk_exposures join */
export function toRiskExposureView(raw: {
  id: string;
  employee_id: string;
  risk_level: string;
  is_active: boolean;
  generates_hazard_pay: boolean;
  hazard_pay_type: string | null;
  hazard_pay_percentage: number | null;
  requires_epi: boolean;
  epi_description: string | null;
  start_date: string;
  end_date: string | null;
  occupational_risk_factors?: { name: string; category: string } | null;
  exposure_groups?: { name: string } | null;
  employees?: { name: string } | null;
}): RiskExposureView {
  return {
    exposure_id: raw.id,
    employee_id: raw.employee_id,
    employee_name: (raw.employees as any)?.name,
    risk_factor_name: (raw.occupational_risk_factors as any)?.name ?? 'Desconhecido',
    risk_factor_category: (raw.occupational_risk_factors as any)?.category ?? 'unknown',
    risk_level: raw.risk_level,
    is_active: raw.is_active,
    generates_hazard_pay: raw.generates_hazard_pay,
    hazard_pay_type: raw.hazard_pay_type,
    hazard_pay_percentage: raw.hazard_pay_percentage,
    requires_epi: raw.requires_epi,
    epi_description: raw.epi_description,
    start_date: raw.start_date,
    end_date: raw.end_date,
    exposure_group_name: (raw.exposure_groups as any)?.name ?? null,
  };
}
