/**
 * DETRAN & Real Fines Integration — Type Definitions
 *
 * Preparation layer for future integration with:
 *  - DETRAN state APIs (vehicle/driver records)
 *  - Real traffic fine data (RENAINF)
 *  - Automatic fine assignment to employees
 *
 * Status: Interface-ready (no live API yet)
 */

// ════════════════════════════════════════════════════════════════
// DETRAN INTEGRATION
// ════════════════════════════════════════════════════════════════

export type DetranState =
  | 'SP' | 'RJ' | 'MG' | 'RS' | 'PR' | 'SC' | 'BA' | 'PE'
  | 'CE' | 'GO' | 'PA' | 'MA' | 'MT' | 'MS' | 'ES' | 'PB'
  | 'RN' | 'AL' | 'PI' | 'SE' | 'RO' | 'TO' | 'AM' | 'AC'
  | 'AP' | 'RR' | 'DF';

export interface DetranProviderConfig {
  id: string;
  tenant_id: string;
  state: DetranState;
  api_url: string;
  /** Encrypted credential reference */
  credential_secret_name: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DetranVehicleRecord {
  plate: string;
  renavam: string;
  chassis: string;
  brand_model: string;
  year_manufacture: number;
  year_model: number;
  color: string;
  fuel_type: string;
  category: string;
  status: 'regular' | 'irregular' | 'stolen' | 'administrative_seizure';
  ipva_status: 'paid' | 'pending' | 'exempt';
  licensing_status: 'valid' | 'expired';
  pending_fines_count: number;
  pending_fines_total_brl: number;
  last_inspection_date: string | null;
  fetched_at: string;
}

export interface DetranDriverRecord {
  cpf: string;
  cnh_number: string;
  cnh_category: string;
  cnh_expiry: string;
  cnh_status: 'valid' | 'expired' | 'suspended' | 'revoked';
  points_accumulated: number;
  points_limit: number;
  restrictions: string[];
  fetched_at: string;
}

// ════════════════════════════════════════════════════════════════
// REAL FINE INTEGRATION (RENAINF)
// ════════════════════════════════════════════════════════════════

export type FineStatus =
  | 'pending'
  | 'notified'
  | 'contested'
  | 'confirmed'
  | 'paid'
  | 'cancelled';

export type FineSeverity = 'leve' | 'media' | 'grave' | 'gravissima';

export interface TrafficFine {
  id: string;
  tenant_id: string;
  /** Matched fleet device */
  device_id: string | null;
  /** Assigned employee (driver at the time) */
  employee_id: string | null;
  company_id: string;
  plate: string;
  auto_infraction_number: string;
  infraction_code: string;
  infraction_description: string;
  severity: FineSeverity;
  points: number;
  amount_brl: number;
  discount_amount_brl: number | null;
  location: string;
  occurred_at: string;
  notification_date: string | null;
  due_date: string | null;
  status: FineStatus;
  /** Whether employee acknowledged responsibility */
  employee_acknowledged: boolean;
  /** Link to signed responsibility term */
  responsibility_document_url: string | null;
  source: 'manual' | 'detran_sync' | 'renainf';
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FineAssignmentRule {
  id: string;
  tenant_id: string;
  company_id: string | null;
  /** Auto-assign fine to employee who was using the vehicle at the time */
  auto_assign_by_tracking: boolean;
  /** Require employee acknowledgment before processing */
  require_acknowledgment: boolean;
  /** Days to contest before auto-confirming */
  contest_window_days: number;
  /** Auto-deduct from payroll if confirmed */
  auto_deduct_payroll: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// DETRAN ADAPTER INTERFACE (for future implementation)
// ════════════════════════════════════════════════════════════════

export interface DetranAdapter {
  readonly state: DetranState;

  fetchVehicleByPlate(plate: string): Promise<DetranVehicleRecord | null>;
  fetchDriverByCPF(cpf: string): Promise<DetranDriverRecord | null>;
  fetchFinesByPlate(plate: string, since?: string): Promise<TrafficFine[]>;

  /** Health check */
  ping(): Promise<boolean>;
}
