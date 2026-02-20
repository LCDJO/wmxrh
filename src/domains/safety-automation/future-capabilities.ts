/**
 * Safety Automation — Future Capability Stubs
 *
 * Preparation for upcoming features:
 *   1. AI Corrective Action Suggestions
 *   2. LMS Integration (Learning Management System)
 *   3. IoT Sensor Integration
 *   4. Automatic Mitigation Plans
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY INVARIANT: These features MUST NOT alter roles,       ║
 * ║  permissions, or plans. All actions require human approval.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════
// 1. AI CORRECTIVE ACTION SUGGESTIONS
// ════════════════════════════════════════════════════════════════

export interface CorrectiveActionSuggestion {
  id: string;
  signal_id: string;
  tenant_id: string;
  suggested_action: string;
  rationale: string;
  confidence: number;             // 0-1
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_resolution_hours: number;
  requires_training: boolean;
  suggested_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

export interface CorrectiveActionAIService {
  /** Analyze a safety signal and suggest corrective actions. */
  suggest(signalId: string, tenantId: string): Promise<CorrectiveActionSuggestion[]>;

  /** Get pending suggestions for a tenant. */
  getPending(tenantId: string): CorrectiveActionSuggestion[];

  /** Accept/reject a suggestion (human approval required). */
  updateStatus(suggestionId: string, status: 'accepted' | 'rejected'): Promise<void>;

  /** Whether the AI model is ready. */
  isReady(): boolean;
}

/** Placeholder — will connect to Lovable AI for corrective action suggestions. */
export class CorrectiveActionAIServiceStub implements CorrectiveActionAIService {
  async suggest(_signalId: string, _tenantId: string): Promise<CorrectiveActionSuggestion[]> {
    // TODO: Integrate with Lovable AI (google/gemini-3-flash-preview)
    // to analyze signal context and suggest corrective actions.
    return [];
  }

  getPending(_tenantId: string): CorrectiveActionSuggestion[] { return []; }
  async updateStatus(_id: string, _status: 'accepted' | 'rejected'): Promise<void> { /* future */ }
  isReady(): boolean { return false; }
}

// ════════════════════════════════════════════════════════════════
// 2. LMS INTEGRATION (Learning Management System)
// ════════════════════════════════════════════════════════════════

export interface LMSCourseMapping {
  risk_type: string;
  nr_codigo: number | null;
  lms_course_id: string;
  lms_course_name: string;
  auto_enroll: boolean;
  priority: 'optional' | 'recommended' | 'mandatory';
}

export interface LMSEnrollmentRequest {
  employee_id: string;
  tenant_id: string;
  course_id: string;
  reason: string;
  triggered_by: 'safety_signal' | 'compliance_scan' | 'manual';
  deadline: string | null;
}

export interface LMSIntegrationService {
  /** Find courses mapped to a risk type or NR. */
  findCourses(riskType: string, nrCodigo?: number): LMSCourseMapping[];

  /** Enroll an employee in a course (requires approval if auto_enroll=false). */
  enroll(request: LMSEnrollmentRequest): Promise<{ enrolled: boolean; reason: string }>;

  /** Check enrollment status for an employee. */
  getEnrollmentStatus(employeeId: string, courseId: string): Promise<'not_enrolled' | 'enrolled' | 'completed' | 'expired'>;

  /** Whether LMS connection is active. */
  isConnected(): boolean;
}

/** Placeholder — will integrate with external LMS providers. */
export class LMSIntegrationServiceStub implements LMSIntegrationService {
  findCourses(_riskType: string, _nrCodigo?: number): LMSCourseMapping[] { return []; }

  async enroll(_request: LMSEnrollmentRequest): Promise<{ enrolled: boolean; reason: string }> {
    return { enrolled: false, reason: 'LMS integration not yet active' };
  }

  async getEnrollmentStatus(_employeeId: string, _courseId: string) {
    return 'not_enrolled' as const;
  }

  isConnected(): boolean { return false; }
}

// ════════════════════════════════════════════════════════════════
// 3. IoT SENSOR INTEGRATION
// ════════════════════════════════════════════════════════════════

export type SensorType = 'temperature' | 'humidity' | 'noise' | 'gas' | 'vibration' | 'radiation' | 'dust';

export interface SensorReading {
  sensor_id: string;
  sensor_type: SensorType;
  location_id: string;
  value: number;
  unit: string;
  timestamp: number;
  is_above_threshold: boolean;
  threshold_value: number | null;
}

export interface SensorAlert {
  id: string;
  sensor_id: string;
  tenant_id: string;
  alert_type: 'warning' | 'critical' | 'emergency';
  reading: SensorReading;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface IoTSensorService {
  /** Get latest reading from a sensor. */
  getLatestReading(sensorId: string): Promise<SensorReading | null>;

  /** Get all active alerts for a tenant location. */
  getActiveAlerts(tenantId: string, locationId?: string): SensorAlert[];

  /** Register a new sensor for monitoring. */
  registerSensor(sensorId: string, type: SensorType, locationId: string, thresholds: Record<string, number>): Promise<boolean>;

  /** Whether the IoT gateway is connected. */
  isConnected(): boolean;
}

/** Placeholder — will integrate with IoT sensor gateways (MQTT/HTTP). */
export class IoTSensorServiceStub implements IoTSensorService {
  async getLatestReading(_sensorId: string): Promise<SensorReading | null> { return null; }
  getActiveAlerts(_tenantId: string, _locationId?: string): SensorAlert[] { return []; }
  async registerSensor(): Promise<boolean> { return false; }
  isConnected(): boolean { return false; }
}

// ════════════════════════════════════════════════════════════════
// 4. AUTOMATIC MITIGATION PLANS
// ════════════════════════════════════════════════════════════════

export interface MitigationStep {
  order: number;
  action: string;
  responsible_role: string;
  deadline_hours: number;
  requires_evidence: boolean;
  evidence_type?: 'photo' | 'document' | 'signature' | 'checklist';
}

export interface MitigationPlan {
  id: string;
  tenant_id: string;
  company_id: string;
  risk_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  steps: MitigationStep[];
  status: 'draft' | 'pending_approval' | 'active' | 'completed' | 'cancelled';
  generated_by: 'ai' | 'template' | 'manual';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface MitigationPlanService {
  /** Generate a mitigation plan from a safety signal (AI-assisted). */
  generate(tenantId: string, companyId: string, riskType: string, severity: string): Promise<MitigationPlan>;

  /** Get active plans for a company. */
  getActivePlans(tenantId: string, companyId?: string): MitigationPlan[];

  /** Approve a generated plan (requires human approval). */
  approve(planId: string, approverId: string): Promise<boolean>;

  /** Mark a step as completed with evidence. */
  completeStep(planId: string, stepOrder: number, evidence?: Record<string, unknown>): Promise<boolean>;
}

/** Placeholder — will generate mitigation plans via AI + compliance templates. */
export class MitigationPlanServiceStub implements MitigationPlanService {
  async generate(tenantId: string, companyId: string, riskType: string, _severity: string): Promise<MitigationPlan> {
    return {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      company_id: companyId,
      risk_type: riskType,
      severity: 'medium',
      title: `Plano de mitigação: ${riskType}`,
      description: 'Plano gerado automaticamente (stub — não ativo)',
      steps: [],
      status: 'draft',
      generated_by: 'ai',
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString(),
    };
  }

  getActivePlans(_tenantId: string, _companyId?: string): MitigationPlan[] { return []; }
  async approve(_planId: string, _approverId: string): Promise<boolean> { return false; }
  async completeStep(_planId: string, _stepOrder: number): Promise<boolean> { return false; }
}
