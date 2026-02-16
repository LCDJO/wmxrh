/**
 * Domain Types - Shared Kernel
 * Central type definitions for the HR domain model.
 * These types are infrastructure-agnostic and represent the domain contract.
 * When migrating to microservices, these become the API contract types.
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

export interface CompanyGroup {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
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

export interface Department {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  tenant_id: string;
  company_id: string;
  title: string;
  level: string | null;
  base_salary: number | null;
  max_salary: number | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
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

export interface SalaryHistory {
  id: string;
  tenant_id: string;
  employee_id: string;
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

export interface SalaryContract {
  id: string;
  tenant_id: string;
  employee_id: string;
  base_salary: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SalaryAdjustment {
  id: string;
  tenant_id: string;
  employee_id: string;
  contract_id: string;
  adjustment_type: SalaryAdjustmentType;
  percentage: number | null;
  previous_salary: number;
  new_salary: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalaryAdditional {
  id: string;
  tenant_id: string;
  employee_id: string;
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
// AGGREGATE VIEWS (with joined data)
// ========================

export interface EmployeeWithRelations extends Employee {
  positions?: { title: string } | null;
  departments?: { name: string } | null;
  companies?: { name: string } | null;
  manager?: { name: string }[] | null;
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
  name: string;
  budget?: number;
}

export interface CreatePositionDTO {
  tenant_id: string;
  company_id: string;
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
  previous_salary: number;
  new_salary: number;
  reason?: string | null;
  effective_date: string;
  approved_by?: string | null;
}

export interface CreateSalaryContractDTO {
  tenant_id: string;
  employee_id: string;
  base_salary: number;
  start_date: string;
  created_by?: string | null;
}

export interface CreateSalaryAdjustmentDTO {
  tenant_id: string;
  employee_id: string;
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
  additional_type: SalaryAdditionalType;
  amount: number;
  is_recurring?: boolean;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  created_by?: string | null;
}
