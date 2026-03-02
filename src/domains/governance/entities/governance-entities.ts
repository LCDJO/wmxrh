/**
 * GovernanceCoreEngine — Entity Types
 *
 * All governance domain entities as value objects / DTOs.
 */

// ════════════════════════════════════
// LegalEvent — Append-only immutable record
// ════════════════════════════════════

export type LegalEventCategory =
  | 'advertencia'
  | 'suspensao'
  | 'afastamento'
  | 'desligamento'
  | 'readmissao'
  | 'transferencia'
  | 'promocao'
  | 'mudanca_contratual'
  | 'outro';

export type LegalEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface LegalEvent {
  id: string;
  tenant_id: string;
  employee_id: string;
  category: LegalEventCategory;
  severity: LegalEventSeverity;
  title: string;
  description: string;
  legal_basis: string | null;
  effective_date: string;
  expiry_date: string | null;
  issued_by: string;
  witness_ids: string[];
  attachments: string[];
  metadata: Record<string, unknown>;
  occurred_at: string;
}

// ════════════════════════════════════
// Policy
// ════════════════════════════════════

export type PolicyScope = 'global' | 'tenant' | 'company' | 'department';
export type PolicyStatus = 'draft' | 'active' | 'archived' | 'revoked';

export interface Policy {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: PolicyScope;
  status: PolicyStatus;
  category: string;
  requires_acceptance: boolean;
  grace_period_days: number;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════
// PolicyVersion — Immutable
// ════════════════════════════════════

export interface PolicyVersion {
  id: string;
  policy_id: string;
  tenant_id: string;
  version_number: number;
  title: string;
  content_html: string;
  content_hash: string;
  change_summary: string | null;
  requires_reacceptance: boolean;
  published_at: string;
  published_by: string;
}

// ════════════════════════════════════
// SanctionRecord
// ════════════════════════════════════

export type SanctionType = 'advertencia_verbal' | 'advertencia_escrita' | 'suspensao' | 'justa_causa';
export type SanctionStatus = 'applied' | 'contested' | 'revoked' | 'expired';

export interface SanctionRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  sanction_type: SanctionType;
  status: SanctionStatus;
  reason: string;
  legal_basis: string | null;
  severity: LegalEventSeverity;
  applied_at: string;
  applied_by: string;
  expiry_date: string | null;
  duration_days: number | null;
  witness_ids: string[];
  related_legal_event_id: string | null;
  notes: string | null;
  contested_at: string | null;
  contest_reason: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

// ════════════════════════════════════
// RiskAssessment
// ════════════════════════════════════

export type RiskCategory = 'behavioral' | 'compliance' | 'performance' | 'legal' | 'financial';

export interface RiskAssessment {
  id: string;
  tenant_id: string;
  employee_id: string;
  category: RiskCategory;
  risk_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  contributing_factors: RiskFactor[];
  recommendation: string | null;
  assessed_at: string;
  assessed_by: string;
  valid_until: string | null;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  value: number;
  description: string;
}

// ════════════════════════════════════
// AdministrativeDecision
// ════════════════════════════════════

export type DecisionType =
  | 'advertencia'
  | 'suspensao'
  | 'afastamento'
  | 'desligamento'
  | 'readmissao'
  | 'promocao'
  | 'transferencia';

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';

export interface AdministrativeDecision {
  id: string;
  tenant_id: string;
  employee_id: string;
  decision_type: DecisionType;
  status: DecisionStatus;
  justification: string;
  legal_basis: string | null;
  risk_assessment_id: string | null;
  related_sanction_ids: string[];
  requested_by: string;
  approved_by: string | null;
  executed_at: string | null;
  effective_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════
// EmployeeLegalTimeline — Projection
// ════════════════════════════════════

export type TimelineEntryType =
  | 'legal_event'
  | 'sanction'
  | 'risk_assessment'
  | 'decision'
  | 'policy_acceptance';

export interface EmployeeLegalTimelineEntry {
  id: string;
  entry_type: TimelineEntryType;
  category: string;
  severity: LegalEventSeverity;
  title: string;
  summary: string;
  reference_id: string;
  occurred_at: string;
  actor_id: string | null;
}

export interface EmployeeLegalTimeline {
  employee_id: string;
  tenant_id: string;
  entries: EmployeeLegalTimelineEntry[];
  total_sanctions: number;
  active_sanctions: number;
  current_risk_level: string;
  last_assessment_at: string | null;
  last_event_at: string | null;
}
