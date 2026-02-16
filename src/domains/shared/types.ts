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
export type TenantRole = 'owner' | 'admin' | 'manager' | 'viewer';

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
  department_id: string | null;
  position_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  status: EmployeeStatus;
  base_salary: number | null;
  current_salary: number | null;
  created_at: string;
  updated_at: string;
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
// AGGREGATE VIEWS (with joined data)
// ========================

export interface EmployeeWithRelations extends Employee {
  positions?: { title: string } | null;
  departments?: { name: string } | null;
  companies?: { name: string } | null;
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
  name: string;
  email?: string | null;
  phone?: string | null;
  base_salary?: number;
  current_salary?: number;
  hire_date?: string;
  department_id?: string;
  position_id?: string;
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
