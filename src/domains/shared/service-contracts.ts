/**
 * Service Interface Contracts
 * 
 * These interfaces define the contract for each domain service.
 * Currently implemented with Supabase (monolith).
 * When migrating to microservices, create new implementations
 * that call REST/gRPC APIs instead.
 * 
 * Pattern: Repository + Service pattern
 * - Services encapsulate business logic
 * - Repository pattern abstracts data access
 * - Swap implementations without touching UI code
 */

import type {
  Tenant, TenantMembership, TenantRole, UserRole, ScopeType,
  CompanyGroup, Company, Department, Position,
  Employee, EmployeeWithRelations, EmployeeEvent, SalaryHistory,
  SalaryContract, SalaryContractWithRelations,
  SalaryAdjustment, SalaryAdjustmentWithRelations,
  SalaryAdditional,
  CompanyWithRelations, PositionWithRelations, DepartmentWithRelations,
  SalaryHistoryWithRelations,
  CreateTenantDTO, CreateCompanyDTO, CreateCompanyGroupDTO,
  CreateDepartmentDTO, CreatePositionDTO, CreateEmployeeDTO,
  CreateSalaryHistoryDTO, CreateSalaryContractDTO,
  CreateSalaryAdjustmentDTO, CreateSalaryAdditionalDTO,
} from './types';

export interface ITenantService {
  list(): Promise<Tenant[]>;
  create(data: CreateTenantDTO): Promise<Tenant>;
  getMemberships(userId: string): Promise<(TenantMembership & { tenants: Tenant })[]>;
}

export interface IUserRoleService {
  listByTenant(tenantId: string): Promise<UserRole[]>;
  create(data: { user_id: string; tenant_id: string; role: TenantRole; scope_type: ScopeType; scope_id?: string | null }): Promise<UserRole>;
  delete(id: string): Promise<void>;
}

export interface ICompanyGroupService {
  list(tenantId: string): Promise<CompanyGroup[]>;
  create(data: CreateCompanyGroupDTO): Promise<CompanyGroup>;
}

export interface ICompanyService {
  list(tenantId: string): Promise<CompanyWithRelations[]>;
  listSimple(tenantId: string): Promise<Pick<Company, 'id' | 'name'>[]>;
  create(data: CreateCompanyDTO): Promise<Company>;
}

export interface IDepartmentService {
  list(tenantId: string): Promise<DepartmentWithRelations[]>;
  create(data: CreateDepartmentDTO): Promise<Department>;
}

export interface IPositionService {
  list(tenantId: string): Promise<PositionWithRelations[]>;
  create(data: CreatePositionDTO): Promise<Position>;
}

export interface IEmployeeService {
  list(tenantId: string): Promise<EmployeeWithRelations[]>;
  listSimple(tenantId: string): Promise<Pick<Employee, 'id' | 'company_id' | 'department_id' | 'position_id' | 'current_salary' | 'status'>[]>;
  getById(id: string): Promise<EmployeeWithRelations | null>;
  create(data: CreateEmployeeDTO): Promise<Employee>;
}

export interface IEmployeeEventService {
  listByEmployee(employeeId: string): Promise<EmployeeEvent[]>;
  listByTenant(tenantId: string): Promise<EmployeeEvent[]>;
}

export interface ISalaryHistoryService {
  listByTenant(tenantId: string): Promise<SalaryHistoryWithRelations[]>;
  listByEmployee(employeeId: string): Promise<SalaryHistory[]>;
  create(data: CreateSalaryHistoryDTO): Promise<SalaryHistory>;
}

export interface ISalaryContractService {
  listByEmployee(employeeId: string): Promise<SalaryContract[]>;
  getActive(employeeId: string): Promise<SalaryContract | null>;
  create(data: CreateSalaryContractDTO): Promise<SalaryContract>;
}

export interface ISalaryAdjustmentService {
  listByEmployee(employeeId: string): Promise<SalaryAdjustment[]>;
  listByTenant(tenantId: string): Promise<SalaryAdjustmentWithRelations[]>;
  create(data: CreateSalaryAdjustmentDTO): Promise<SalaryAdjustment>;
}

export interface ISalaryAdditionalService {
  listByEmployee(employeeId: string): Promise<SalaryAdditional[]>;
  create(data: CreateSalaryAdditionalDTO): Promise<SalaryAdditional>;
}
