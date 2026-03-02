/**
 * WorkTime Compliance Engine — Types
 * Portaria 671/2021 · CLT Art. 74
 */

// ── Ledger ──
export type WorkTimeEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export type WorkTimeSource = 'manual' | 'biometric' | 'geofence' | 'app' | 'api';
export type WorkTimeEntryStatus = 'valid' | 'rejected' | 'flagged';

export interface WorkTimeLedgerEntry {
  id: string;
  tenant_id: string;
  employee_id: string;
  event_type: WorkTimeEventType;
  recorded_at: string;
  server_timestamp: string;
  source: WorkTimeSource;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  device_fingerprint: string | null;
  device_model: string | null;
  device_os: string | null;
  app_version: string | null;
  ip_address: string | null;
  geofence_id: string | null;
  geofence_matched: boolean;
  photo_proof_url: string | null;
  nsr_sequence: number | null;
  integrity_hash: string;
  previous_hash: string | null;
  server_signature: string | null;
  signature_algorithm: string | null;
  is_offline_sync: boolean;
  offline_recorded_at: string | null;
  status: WorkTimeEntryStatus;
  // Employee identification (Portaria 671/2021)
  employee_name: string | null;
  employee_cpf_masked: string | null;
  employee_pis: string | null;
  created_at: string;
}

export interface CreateTimeEntryDTO {
  employee_id: string;
  event_type: WorkTimeEventType;
  source?: WorkTimeSource;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  device_fingerprint?: string;
  device_model?: string;
  device_os?: string;
  app_version?: string;
  ip_address?: string;
  geofence_id?: string;
  photo_proof_url?: string;
  is_offline_sync?: boolean;
  offline_recorded_at?: string;
  // Device integrity signals (sent from mobile app)
  is_rooted?: boolean;
  is_mock_location?: boolean;
  is_vpn_active?: boolean;
  network_type?: string;
}

// ── Adjustments ──
export type AdjustmentType = 'correction' | 'addition' | 'invalidation';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface LedgerAdjustment {
  id: string;
  tenant_id: string;
  original_entry_id: string;
  adjustment_type: AdjustmentType;
  new_recorded_at: string | null;
  new_event_type: string | null;
  reason: string;
  legal_basis: string | null;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_status: ApprovalStatus;
  integrity_hash: string;
  server_signature: string | null;
  created_at: string;
}

export interface CreateAdjustmentDTO {
  original_entry_id: string;
  adjustment_type: AdjustmentType;
  new_recorded_at?: string;
  new_event_type?: string;
  reason: string;
  legal_basis?: string;
  requested_by?: string;
}

// ── Geofence ──
export type GeofenceType = 'work_site' | 'branch' | 'client_site' | 'restricted';
export type GeofenceEnforcementMode = 'block' | 'flag';

export interface WorkTimeGeofence {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  tolerance_meters: number;
  enforcement_mode: GeofenceEnforcementMode;
  geofence_type: GeofenceType;
  is_active: boolean;
  allowed_clock_types: WorkTimeEventType[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateGeofenceDTO {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  tolerance_meters?: number;
  enforcement_mode?: GeofenceEnforcementMode;
  geofence_type?: GeofenceType;
  allowed_clock_types?: WorkTimeEventType[];
}

// ── Device ──
export interface WorkTimeDevice {
  id: string;
  tenant_id: string;
  employee_id: string;
  device_fingerprint: string;
  device_model: string | null;
  device_os: string | null;
  is_trusted: boolean;
  trusted_at: string | null;
  trusted_by: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  last_used_at: string | null;
  created_at: string;
}

// ── Fraud ──
export type FraudType =
  | 'location_spoof' | 'device_tamper' | 'time_anomaly' | 'velocity_impossible'
  | 'duplicate_clock' | 'untrusted_device' | 'offline_abuse' | 'pattern_anomaly' | 'photo_mismatch';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FraudAutoAction = 'none' | 'flag' | 'block' | 'notify_manager' | 'suspend_clock';

export interface WorkTimeFraudLog {
  id: string;
  tenant_id: string;
  employee_id: string;
  ledger_entry_id: string | null;
  fraud_type: FraudType;
  severity: FraudSeverity;
  confidence_score: number;
  evidence: Record<string, unknown>;
  auto_action: FraudAutoAction | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

// ── Compliance Audit ──
export type ComplianceAuditType =
  | 'daily_closure' | 'weekly_review' | 'monthly_report' | 'portaria_671_check'
  | 'overtime_limit' | 'break_violation' | 'nocturnal_check' | 'hash_verification'
  | 'retention_check' | 'employee_id_check';

export interface WorkTimeComplianceAudit {
  id: string;
  tenant_id: string;
  audit_type: ComplianceAuditType;
  period_start: string;
  period_end: string;
  employee_id: string | null;
  findings: ComplianceFinding[];
  violations_count: number;
  compliance_score: number;
  audited_by: string;
  report_url: string | null;
  created_at: string;
}

export interface ComplianceFinding {
  code: string;
  severity: 'info' | 'warning' | 'violation';
  description: string;
  legal_reference?: string;
  employee_id?: string;
  date?: string;
  details?: Record<string, unknown>;
}

// ── Retention ──
export interface WorkTimeRetentionPolicy {
  id: string;
  tenant_id: string;
  retention_years: number;
  legal_basis: string;
  auto_archive_after_years: number;
  created_at: string;
  updated_at: string;
}

// ── Audit Trail ──
export interface WorkTimeAuditTrailEntry {
  id: string;
  tenant_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// ── Export ──
export type ExportType = 'AFD' | 'AFDT' | 'ACJEF' | 'AEJ' | 'espelho_ponto' | 'csv' | 'pdf';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface WorkTimeExport {
  id: string;
  tenant_id: string;
  export_type: ExportType;
  period_start: string;
  period_end: string;
  employee_ids: string[] | null;
  status: ExportStatus;
  file_url: string | null;
  file_hash: string | null;
  record_count: number;
  requested_by: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ── Engine API ──
export interface WorkTimeEngineAPI {
  timeEntry: TimeEntryControllerAPI;
  geoFence: GeoFenceValidatorAPI;
  device: DeviceIntegrityValidatorAPI;
  ledger: ImmutableTimeLedgerAPI;
  compliance: TimeComplianceAuditorAPI;
  export: TimeExportServiceAPI;
  antiFraud: AntiFraudAnalyzerAPI;
}

export interface TimeEntryControllerAPI {
  register(tenantId: string, dto: CreateTimeEntryDTO): Promise<WorkTimeLedgerEntry>;
  adjust(tenantId: string, dto: CreateAdjustmentDTO): Promise<LedgerAdjustment>;
  approveAdjustment(adjustmentId: string, approved: boolean): Promise<LedgerAdjustment>;
  getEntries(tenantId: string, employeeId: string, from: string, to: string): Promise<WorkTimeLedgerEntry[]>;
}

export interface GeoFenceValidatorAPI {
  validate(tenantId: string, lat: number, lng: number, eventType: WorkTimeEventType): Promise<GeofenceValidationResult>;
  listZones(tenantId: string): Promise<WorkTimeGeofence[]>;
  createZone(tenantId: string, dto: CreateGeofenceDTO): Promise<WorkTimeGeofence>;
  updateZone(id: string, updates: Partial<CreateGeofenceDTO>): Promise<WorkTimeGeofence>;
  deleteZone(id: string): Promise<void>;
}

export interface GeofenceValidationResult {
  is_valid: boolean;
  matched_geofence: WorkTimeGeofence | null;
  distance_meters: number | null;
  allowed: boolean;
  within_tolerance: boolean;
  enforcement: GeofenceEnforcementMode | null;
  suggested_status: WorkTimeEntryStatus;
  reason?: string;
}

export interface DeviceIntegrityValidatorAPI {
  validate(tenantId: string, employeeId: string, fingerprint: string, signals?: DeviceIntegritySignals): Promise<DeviceValidationResult>;
  listDevices(tenantId: string, employeeId: string): Promise<WorkTimeDevice[]>;
  trustDevice(deviceId: string, trustedBy: string): Promise<WorkTimeDevice>;
  blockDevice(deviceId: string, reason: string): Promise<WorkTimeDevice>;
}

/** Signals collected from the mobile app at clock time */
export interface DeviceIntegritySignals {
  is_rooted?: boolean;
  is_mock_location?: boolean;
  is_vpn_active?: boolean;
  ip_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  network_type?: string;
}

export type DeviceRiskFlag =
  | 'unknown_device' | 'untrusted_device' | 'blocked_device'
  | 'root_jailbreak' | 'mock_location' | 'vpn_detected' | 'ip_geo_mismatch';

export interface DeviceValidationResult {
  is_valid: boolean;
  device: WorkTimeDevice | null;
  is_trusted: boolean;
  is_blocked: boolean;
  is_new: boolean;
  risk_flags: DeviceRiskFlag[];
  risk_score: number;
  should_flag: boolean;
}

export interface ImmutableTimeLedgerAPI {
  getEntries(tenantId: string, employeeId: string, from: string, to: string): Promise<WorkTimeLedgerEntry[]>;
  getLastEntry(tenantId: string, employeeId: string): Promise<WorkTimeLedgerEntry | null>;
  verifyChain(tenantId: string, employeeId: string, from: string, to: string): Promise<ChainVerificationResult>;
}

export interface ChainVerificationResult {
  is_valid: boolean;
  entries_checked: number;
  broken_at?: string;
  details?: string;
}

export interface TimeComplianceAuditorAPI {
  runDailyAudit(tenantId: string, date: string, employeeId?: string): Promise<WorkTimeComplianceAudit>;
  runPortaria671Check(tenantId: string, periodStart: string, periodEnd: string): Promise<WorkTimeComplianceAudit>;
  getAudits(tenantId: string, opts?: { auditType?: ComplianceAuditType; limit?: number }): Promise<WorkTimeComplianceAudit[]>;
}

export interface TimeExportServiceAPI {
  requestExport(tenantId: string, exportType: ExportType, periodStart: string, periodEnd: string, employeeIds?: string[], requestedBy?: string): Promise<WorkTimeExport>;
  getExports(tenantId: string, limit?: number): Promise<WorkTimeExport[]>;
}

export interface AntiFraudAnalyzerAPI {
  analyze(tenantId: string, entry: WorkTimeLedgerEntry): Promise<WorkTimeFraudLog[]>;
  getFraudLogs(tenantId: string, opts?: { employeeId?: string; resolved?: boolean; limit?: number }): Promise<WorkTimeFraudLog[]>;
  resolve(fraudLogId: string, resolvedBy: string, notes: string): Promise<void>;
  getStats(tenantId: string): Promise<FraudStats>;
}

export interface FraudStats {
  total: number;
  unresolved: number;
  by_type: Record<FraudType, number>;
  by_severity: Record<FraudSeverity, number>;
  avg_confidence: number;
}
