/**
 * Domain Types - Shared Kernel
 * Central type definitions for the HR domain model.
 * These types are infrastructure-agnostic and represent the domain contract.
 */

// ========================
// VALUE OBJECTS
// ========================

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave';
export type TenantRole = 'owner' | 'admin' | 'manager' | 'viewer' | 'superadmin' | 'tenant_admin' | 'group_admin' | 'company_admin' | 'rh' | 'gestor' | 'financeiro';
export type EmployeeEventType = 'company_transfer' | 'position_change' | 'department_change' | 'status_change' | 'manager_change' | 'salary_change' | 'employee_hired' | 'salary_contract_started' | 'salary_adjusted' | 'additional_added' | 'job_changed';
export type SalaryAdjustmentType = 'annual' | 'promotion' | 'adjustment' | 'merit' | 'correction';
export type SalaryAdditionalType = 'bonus' | 'commission' | 'allowance' | 'hazard_pay' | 'overtime' | 'other';

// ========================
// SOFT DELETE MIXIN
// ========================

export interface SoftDeletable {
  deleted_at: string | null;
}

// ========================
// ENTITIES
// ========================

export type TenantStatus = 'active' | 'inactive' | 'suspended';
export type CompanyStatus = 'active' | 'inactive';
export type ScopeType = 'tenant' | 'company_group' | 'company';

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  scope_type: ScopeType;
  scope_id: string | null;
  created_at: string;
}

export interface CompanyGroup extends SoftDeletable {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company extends SoftDeletable {
  id: string;
  tenant_id: string;
  company_group_id: string | null;
  name: string;
  status: CompanyStatus;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department extends SoftDeletable {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  name: string;
  budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface Position extends SoftDeletable {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  title: string;
  level: string | null;
  base_salary: number | null;
  max_salary: number | null;
  created_at: string;
  updated_at: string;
}

export interface Employee extends SoftDeletable {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  user_id: string | null;
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  status: EmployeeStatus;
  base_salary: number | null;
  current_salary: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeEvent {
  id: string;
  tenant_id: string;
  employee_id: string;
  event_type: EmployeeEventType;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface SalaryHistory extends SoftDeletable {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  previous_salary: number;
  new_salary: number;
  reason: string | null;
  effective_date: string;
  approved_by: string | null;
  created_at: string;
}

// ========================
// COMPENSATION ENGINE ENTITIES
// ========================

export interface SalaryContract extends SoftDeletable {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  base_salary: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SalaryAdjustment extends SoftDeletable {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  contract_id: string;
  adjustment_type: SalaryAdjustmentType;
  percentage: number | null;
  previous_salary: number;
  new_salary: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalaryAdditional extends SoftDeletable {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  additional_type: SalaryAdditionalType;
  amount: number;
  is_recurring: boolean;
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalaryContractWithRelations extends SalaryContract {
  employees?: { name: string } | null;
}

export interface SalaryAdjustmentWithRelations extends SalaryAdjustment {
  employees?: { name: string } | null;
}

// ========================
// AUDIT LOG
// ========================

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string;
  tenant_id: string;
  company_group_id: string | null;
  company_id: string | null;
  user_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ========================
// AGGREGATE VIEWS (with joined data)
// ========================

export interface EmployeeWithRelations extends Employee {
  positions?: { title: string } | null;
  departments?: { name: string } | null;
  companies?: { name: string } | null;
  manager?: { name: string } | null;
}

export interface CompanyWithRelations extends Company {
  company_groups?: { name: string } | null;
}

export interface PositionWithRelations extends Position {
  companies?: { name: string } | null;
}

export interface DepartmentWithRelations extends Department {
  companies?: { name: string } | null;
}

export interface SalaryHistoryWithRelations extends SalaryHistory {
  employees?: { name: string } | null;
}

// ========================
// DTOs (Data Transfer Objects for mutations)
// ========================

export interface CreateEmployeeDTO {
  tenant_id: string;
  company_id: string;
  company_group_id?: string | null;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  base_salary?: number;
  current_salary?: number;
  hire_date?: string;
  department_id?: string;
  position_id?: string;
  manager_id?: string | null;
}

export interface CreateCompanyDTO {
  tenant_id: string;
  name: string;
  document?: string | null;
  company_group_id?: string | null;
}

export interface CreateCompanyGroupDTO {
  tenant_id: string;
  name: string;
  description?: string | null;
}

export interface CreateDepartmentDTO {
  tenant_id: string;
  company_id: string;
  company_group_id?: string | null;
  name: string;
  budget?: number;
}

export interface CreatePositionDTO {
  tenant_id: string;
  company_id: string;
  company_group_id?: string | null;
  title: string;
  level?: string | null;
  base_salary?: number;
  max_salary?: number;
}

export interface CreateTenantDTO {
  name: string;
  document?: string | null;
}

export interface CreateSalaryHistoryDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  previous_salary: number;
  new_salary: number;
  reason?: string | null;
  effective_date: string;
  approved_by?: string | null;
}

export interface CreateSalaryContractDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  base_salary: number;
  start_date: string;
  created_by?: string | null;
}

export interface CreateSalaryAdjustmentDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  contract_id: string;
  adjustment_type: SalaryAdjustmentType;
  percentage?: number | null;
  previous_salary: number;
  new_salary: number;
  reason?: string | null;
  created_by?: string | null;
}

export interface CreateSalaryAdditionalDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  additional_type: SalaryAdditionalType;
  amount: number;
  is_recurring?: boolean;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  created_by?: string | null;
}

// ========================
// LABOR COMPLIANCE TYPES
// ========================

export type PayrollItemType = 'provento' | 'desconto';
export type PayrollItemNature = 'fixed' | 'variable' | 'informational';
export type PayrollIncidence = 'inss' | 'irrf' | 'fgts' | 'inss_irrf' | 'inss_fgts' | 'irrf_fgts' | 'all' | 'none';
export type BenefitType = 'va' | 'vr' | 'vt' | 'health' | 'dental';
export type ExamType = 'admissional' | 'periodico' | 'demissional' | 'mudanca_funcao' | 'retorno_trabalho';
export type ExamResult = 'apto' | 'inapto' | 'apto_restricao';
export type RiskCategory = 'fisico' | 'quimico' | 'biologico' | 'ergonomico' | 'acidente';
export type HealthProgramType = 'pcmso' | 'pgr' | 'ltcat' | 'ppra';

export interface PayrollItemCatalog {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  item_type: PayrollItemType;
  nature: PayrollItemNature;
  incidence: PayrollIncidence;
  esocial_code: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeePayrollItem {
  id: string;
  tenant_id: string;
  employee_id: string;
  catalog_item_id: string;
  company_id: string | null;
  company_group_id: string | null;
  amount: number;
  percentage: number | null;
  reference_value: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  payroll_item_catalog?: PayrollItemCatalog | null;
}

export interface TaxBracket {
  id: string;
  tenant_id: string;
  tax_type: string;
  bracket_order: number;
  min_value: number;
  max_value: number | null;
  rate: number;
  deduction: number;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BenefitPlan {
  id: string;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  benefit_type: BenefitType;
  name: string;
  provider: string | null;
  plan_code: string | null;
  base_value: number;
  employer_percentage: number | null;
  employee_discount_percentage: number | null;
  has_coparticipation: boolean;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeBenefit {
  id: string;
  tenant_id: string;
  employee_id: string;
  benefit_plan_id: string;
  company_id: string | null;
  company_group_id: string | null;
  custom_value: number | null;
  dependents_count: number;
  card_number: string | null;
  enrollment_date: string;
  cancellation_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  benefit_plans?: BenefitPlan | null;
}

export interface OccupationalRiskFactor {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: RiskCategory;
  esocial_code: string | null;
  description: string | null;
  exposure_limit: string | null;
  measurement_unit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExposureGroup {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  name: string;
  code: string;
  description: string | null;
  cbo_code: string | null;
  environment: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HealthProgram {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  program_type: HealthProgramType;
  name: string;
  responsible_name: string | null;
  responsible_registration: string | null;
  valid_from: string;
  valid_until: string;
  document_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeHealthExam {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  health_program_id: string | null;
  exam_type: ExamType;
  exam_date: string;
  expiry_date: string | null;
  result: ExamResult;
  physician_name: string | null;
  physician_crm: string | null;
  observations: string | null;
  cbo_code: string | null;
  risk_factors_evaluated: string[] | null;
  is_valid: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PayrollSimulationResult {
  base_salary: number;
  inss: number;
  irrf: number;
  fgts: number;
  net_salary: number;
  total_employer_cost: number;
  reference_date: string;
}

// DTOs
export interface CreatePayrollItemCatalogDTO {
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  item_type: PayrollItemType;
  nature?: PayrollItemNature;
  incidence?: PayrollIncidence;
  esocial_code?: string | null;
}

export interface CreateBenefitPlanDTO {
  tenant_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  benefit_type: BenefitType;
  name: string;
  provider?: string | null;
  plan_code?: string | null;
  base_value: number;
  employer_percentage?: number;
  employee_discount_percentage?: number;
  has_coparticipation?: boolean;
  description?: string | null;
}

export interface CreateEmployeeBenefitDTO {
  tenant_id: string;
  employee_id: string;
  benefit_plan_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  custom_value?: number | null;
  dependents_count?: number;
  card_number?: string | null;
  enrollment_date?: string;
  notes?: string | null;
}

export interface CreateHealthProgramDTO {
  tenant_id: string;
  company_id: string;
  company_group_id?: string | null;
  program_type: HealthProgramType;
  name: string;
  responsible_name?: string | null;
  responsible_registration?: string | null;
  valid_from: string;
  valid_until: string;
  document_url?: string | null;
  notes?: string | null;
}

export interface CreateHealthExamDTO {
  tenant_id: string;
  employee_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  health_program_id?: string | null;
  exam_type: ExamType;
  exam_date: string;
  expiry_date?: string | null;
  result?: ExamResult;
  physician_name?: string | null;
  physician_crm?: string | null;
  observations?: string | null;
  cbo_code?: string | null;
  risk_factors_evaluated?: string[];
  created_by?: string | null;
}
