/**
 * GovernanceCoreEngine — Employee Lifecycle Events
 *
 * Canonical events emitted by the Employee Lifecycle Engine
 * that feed into the OrganizationalIntelligenceEngine.
 *
 * Every relevant HR action emits one of these events through
 * the GovernanceEventStore (append-only, immutable).
 */

export const EMPLOYEE_LIFECYCLE_EVENTS = {
  // Hiring
  EmployeeHired: 'EmployeeHired',
  EmployeeOnboarded: 'EmployeeOnboarded',
  EmployeeProbationCompleted: 'EmployeeProbationCompleted',

  // Warnings
  EmployeeWarned: 'EmployeeWarned',

  // Suspension
  EmployeeSuspended: 'EmployeeSuspended',
  EmployeeSuspensionLifted: 'EmployeeSuspensionLifted',

  // Leave
  EmployeeLeaveStarted: 'EmployeeLeaveStarted',
  EmployeeLeaveEnded: 'EmployeeLeaveEnded',

  // Termination
  EmployeeTerminated: 'EmployeeTerminated',
  EmployeeResigned: 'EmployeeResigned',

  // Performance
  PerformanceReviewCompleted: 'PerformanceReviewCompleted',
  DevelopmentPlanCreated: 'DevelopmentPlanCreated',

  // Structural
  EmployeePromoted: 'EmployeePromoted',
  EmployeeTransferred: 'EmployeeTransferred',
  EmployeeContractChanged: 'EmployeeContractChanged',
  EmployeeSalaryAdjusted: 'EmployeeSalaryAdjusted',
} as const;

export type EmployeeLifecycleEventType = typeof EMPLOYEE_LIFECYCLE_EVENTS[keyof typeof EMPLOYEE_LIFECYCLE_EVENTS];

// ── Payloads ──

export interface EmployeeHiredPayload {
  employee_id: string;
  nome: string;
  cpf: string;
  cargo_id: string | null;
  departamento_id: string | null;
  empresa_id: string | null;
  tipo_contrato: string;
  data_admissao: string;
  salario_base: number | null;
  cbo_codigo: string | null;
  hired_by: string;
}

export interface EmployeeWarnedPayload {
  employee_id: string;
  tipo: 'verbal' | 'escrita';
  motivo: string;
  base_legal: string | null;
  data_ocorrencia: string;
  issued_by: string;
  severity: string;
  sanction_count: number;
}

export interface EmployeeSuspendedPayload {
  employee_id: string;
  motivo: string;
  base_legal: string | null;
  data_inicio: string;
  data_fim: string;
  duracao_dias: number;
  com_remuneracao: boolean;
  issued_by: string;
}

export interface EmployeeTerminatedPayload {
  employee_id: string;
  tipo: string;
  motivo: string;
  base_legal: string | null;
  data_desligamento: string;
  aviso_previo_cumprido: boolean;
  aviso_previo_indenizado: boolean;
  sancoes_relacionadas: string[];
  terminated_by: string;
}

export interface PerformanceReviewPayload {
  employee_id: string;
  review_type: '90' | '180' | '360';
  score: number;
  period_start: string;
  period_end: string;
  reviewed_by: string;
  strengths: string[];
  improvement_areas: string[];
}

export interface EmployeePromotedPayload {
  employee_id: string;
  cargo_anterior_id: string | null;
  cargo_novo_id: string;
  departamento_anterior_id: string | null;
  departamento_novo_id: string | null;
  salario_anterior: number | null;
  salario_novo: number | null;
  effective_date: string;
  promoted_by: string;
}
