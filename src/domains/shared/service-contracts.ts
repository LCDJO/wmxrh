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
  Tenant, TenantMembership,
  CompanyGroup, Company, Department, Position,
  Employee, EmployeeWithRelations, SalaryHistory,
  CompanyWithRelations, PositionWithRelations, DepartmentWithRelations,
  SalaryHistoryWithRelations,
  CreateTenantDTO, CreateCompanyDTO, CreateCompanyGroupDTO,
  CreateDepartmentDTO, CreatePositionDTO, CreateEmployeeDTO,
  CreateSalaryHistoryDTO,
} from './types';

export interface ITenantService {
  list(): Promise<Tenant[]>;
  create(data: CreateTenantDTO): Promise<Tenant>;
  getMemberships(userId: string): Promise<(TenantMembership & { tenants: Tenant })[]>;
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

export interface ISalaryHistoryService {
  listByTenant(tenantId: string): Promise<SalaryHistoryWithRelations[]>;
  listByEmployee(employeeId: string): Promise<SalaryHistory[]>;
  create(data: CreateSalaryHistoryDTO): Promise<SalaryHistory>;
}
