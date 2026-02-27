/**
 * Enterprise Incident Management System — Type Definitions
 *
 * Covers full incident lifecycle: detection → classification → SLA →
 * escalation → notification → resolution → postmortem → availability.
 */

// ══════════════════════════════════
// ENUMS
// ══════════════════════════════════

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';
export type EscalationLevel = 'l1' | 'l2' | 'l3' | 'management' | 'executive';
export type NotificationChannel = 'email' | 'sms' | 'webhook' | 'in_app' | 'telegram';
export type ComponentStatus = 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance';

// ══════════════════════════════════
// CORE MODELS
// ══════════════════════════════════

export interface Incident {
  id: string;
  tenant_id: string | null;
  module_id: string | null;
  affected_tenants: string[];
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  source_ref: string | null;
  affected_modules: string[];
  affected_services: string[];
  impact_description: string | null;
  root_cause: string | null;
  resolution_summary: string | null;
  assigned_to: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  detected_at: string;
  escalation_level: EscalationLevel;
  sla_response_deadline: string | null;
  sla_ack_deadline: string | null;
  sla_resolution_deadline: string | null;
  sla_breached: boolean;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  author_id: string | null;
  update_type: string;
  previous_status: IncidentStatus | null;
  new_status: IncidentStatus | null;
  message: string;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SLAConfig {
  id: string;
  tenant_id: string | null;
  severity: IncidentSeverity;
  response_time_minutes: number;
  acknowledgement_time_minutes: number;
  resolution_time_minutes: number;
  escalation_after_minutes: number;
  notification_interval_minutes: number;
  is_active: boolean;
}

export interface EscalationRecord {
  id: string;
  incident_id: string;
  from_level: EscalationLevel;
  to_level: EscalationLevel;
  reason: string;
  escalated_by: string | null;
  auto_escalated: boolean;
  notified_users: string[];
  created_at: string;
}

export interface IncidentNotification {
  id: string;
  incident_id: string;
  tenant_id: string | null;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface StatusPageComponent {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  component_group: string | null;
  display_order: number;
  current_status: ComponentStatus;
  is_active: boolean;
}

export interface StatusPageIncident {
  id: string;
  incident_id: string;
  tenant_id: string | null;
  title: string;
  impact: string;
  status: string;
  affected_components: string[];
  created_at: string;
  updated_at: string;
}

export interface Postmortem {
  id: string;
  incident_id: string;
  tenant_id: string | null;
  summary: string;
  timeline_events: Array<{ time: string; description: string }>;
  root_cause_analysis: string | null;
  contributing_factors: string[];
  action_items: Array<{ title: string; assignee?: string; due_date?: string; status: string }>;
  lessons_learned: string | null;
  impact_duration_minutes: number | null;
  affected_users_count: number | null;
  revenue_impact_estimate: number | null;
  status: 'draft' | 'review' | 'published';
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_by: string | null;
}

export interface AvailabilityRecord {
  id: string;
  tenant_id: string | null;
  component_id: string | null;
  period_start: string;
  period_end: string;
  period_type: string;
  total_minutes: number;
  downtime_minutes: number;
  uptime_percentage: number;
  incident_count: number;
  sla_target_percentage: number;
  sla_met: boolean;
}

// ══════════════════════════════════
// INPUT TYPES
// ══════════════════════════════════

export interface CreateIncidentInput {
  tenant_id?: string | null;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  source?: string;
  source_ref?: string;
  affected_modules?: string[];
  affected_services?: string[];
  impact_description?: string;
  is_public?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DetectionSignal {
  type: 'health_degraded' | 'error_spike' | 'latency_exceeded' | 'self_healing_failed' | 'manual';
  source_module: string;
  severity_hint: IncidentSeverity;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════
// API INTERFACES
// ══════════════════════════════════

export interface IncidentDetectorAPI {
  processSignal(signal: DetectionSignal): Promise<Incident | null>;
  correlateWithExisting(signal: DetectionSignal): Promise<Incident | null>;
}

export interface SeverityClassifierAPI {
  classify(signal: DetectionSignal): IncidentSeverity;
  reclassify(incident: Incident, newEvidence: Record<string, unknown>): IncidentSeverity;
}

export interface SLAEngineAPI {
  getConfig(severity: IncidentSeverity, tenantId?: string | null): Promise<SLAConfig>;
  applyDeadlines(incident: Incident): Promise<Incident>;
  checkBreaches(): Promise<Incident[]>;
}

export interface EscalationManagerAPI {
  evaluate(incident: Incident): Promise<EscalationLevel | null>;
  escalate(incidentId: string, toLevel: EscalationLevel, reason: string, autoEscalated?: boolean): Promise<void>;
  getHistory(incidentId: string): Promise<EscalationRecord[]>;
}

export interface ClientNotificationServiceAPI {
  notifyIncidentCreated(incident: Incident): Promise<void>;
  notifyStatusUpdate(incident: Incident, update: IncidentUpdate): Promise<void>;
  notifyResolution(incident: Incident): Promise<void>;
  notifySLABreach(incident: Incident): Promise<void>;
}

export interface StatusPageServiceAPI {
  publishIncident(incident: Incident): Promise<StatusPageIncident>;
  updateIncidentStatus(incidentId: string, status: string, message: string): Promise<void>;
  getComponents(tenantId?: string | null): Promise<StatusPageComponent[]>;
  updateComponentStatus(componentId: string, status: ComponentStatus): Promise<void>;
  getPublicIncidents(tenantId?: string | null): Promise<StatusPageIncident[]>;
}

export interface PostmortemManagerAPI {
  create(incidentId: string, summary: string, createdBy?: string): Promise<Postmortem>;
  update(postmortemId: string, patch: Partial<Postmortem>): Promise<void>;
  publish(postmortemId: string, reviewedBy: string): Promise<void>;
  getByIncident(incidentId: string): Promise<Postmortem | null>;
}

export interface AvailabilityReporterAPI {
  recordDowntime(tenantId: string | null, componentId: string | null, downtimeMinutes: number, incidentCount: number): Promise<void>;
  getReport(tenantId: string | null, days?: number): Promise<AvailabilityRecord[]>;
  getCurrentUptime(tenantId?: string | null): Promise<{ uptime_30d: number; uptime_90d: number }>;
}

export interface IncidentManagementEngineAPI {
  detector: IncidentDetectorAPI;
  classifier: SeverityClassifierAPI;
  sla: SLAEngineAPI;
  escalation: EscalationManagerAPI;
  notifications: ClientNotificationServiceAPI;
  statusPage: StatusPageServiceAPI;
  postmortem: PostmortemManagerAPI;
  availability: AvailabilityReporterAPI;

  createIncident(input: CreateIncidentInput): Promise<Incident>;
  acknowledgeIncident(incidentId: string, userId: string): Promise<void>;
  updateIncidentStatus(incidentId: string, status: IncidentStatus, message: string, userId?: string): Promise<void>;
  resolveIncident(incidentId: string, resolution: string, userId?: string): Promise<void>;
  closeIncident(incidentId: string, userId?: string): Promise<void>;
  getIncident(incidentId: string): Promise<Incident | null>;
  listIncidents(filters?: { status?: IncidentStatus; severity?: IncidentSeverity; tenant_id?: string; limit?: number }): Promise<Incident[]>;
  getTimeline(incidentId: string): Promise<IncidentUpdate[]>;
  getDashboardStats(): Promise<IncidentDashboardStats>;
}

export interface IncidentDashboardStats {
  total_open: number;
  by_severity: Record<IncidentSeverity, number>;
  by_status: Record<IncidentStatus, number>;
  mttr_minutes: number;
  sla_breach_count: number;
  uptime_30d: number;
}
