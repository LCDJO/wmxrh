/**
 * Domain Hooks - React Query hooks per bounded context
 * 
 * These hooks encapsulate all data fetching and mutations.
 * Pages only import hooks — never services directly.
 * When migrating to microservices, only the service implementations change.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';

// Services
import { tenantService } from '@/domains/tenant/tenant.service';
import { companyGroupService } from '@/domains/company-group/company-group.service';
import { companyService } from '@/domains/company/company.service';
import { departmentService } from '@/domains/department/department.service';
import { positionService } from '@/domains/position/position.service';
import { employeeService } from '@/domains/employee/employee.service';
import { employeeEventService } from '@/domains/employee/employee-event.service';
import { salaryHistoryService } from '@/domains/compensation/salary-history.service';
import { salaryContractService } from '@/domains/compensation/salary-contract.service';
import { salaryAdjustmentService } from '@/domains/compensation/salary-adjustment.service';
import { salaryAdditionalService } from '@/domains/compensation/salary-additional.service';
import { compensationTimelineService } from '@/domains/compensation/compensation-timeline.service';
import { auditLogService } from '@/domains/audit/audit-log.service';

// Types
import type {
  CreateTenantDTO, CreateCompanyGroupDTO, CreateCompanyDTO,
  CreateDepartmentDTO, CreatePositionDTO, CreateEmployeeDTO,
  CreateSalaryContractDTO, CreateSalaryAdjustmentDTO, CreateSalaryAdditionalDTO,
} from '@/domains/shared';

// ========================
// QUERY KEYS (centralized for cache management)
// ========================

export const queryKeys = {
  employees: (tenantId?: string) => ['employees', tenantId] as const,
  employeesByGroup: (tenantId?: string, groupId?: string) => ['employees_group', tenantId, groupId] as const,
  employeesByCompany: (tenantId?: string, companyId?: string) => ['employees_company', tenantId, companyId] as const,
  employeesSimple: (tenantId?: string) => ['employees-simple', tenantId] as const,
  employee: (id: string) => ['employee', id] as const,
  companies: (tenantId?: string) => ['companies', tenantId] as const,
  companiesSimple: (tenantId?: string) => ['companies-simple', tenantId] as const,
  companyGroups: (tenantId?: string) => ['company_groups', tenantId] as const,
  departments: (tenantId?: string) => ['departments', tenantId] as const,
  positions: (tenantId?: string) => ['positions', tenantId] as const,
  salaryHistoryTenant: (tenantId?: string) => ['salary_history_all', tenantId] as const,
  salaryHistoryEmployee: (empId: string) => ['salary_history', empId] as const,
  employeeEvents: (empId: string) => ['employee_events', empId] as const,
  employeeEventsTenant: (tenantId?: string) => ['employee_events_tenant', tenantId] as const,
  salaryContracts: (empId: string) => ['salary_contracts', empId] as const,
  salaryContractActive: (empId: string) => ['salary_contract_active', empId] as const,
  salaryAdjustments: (empId: string) => ['salary_adjustments', empId] as const,
  salaryAdjustmentsTenant: (tenantId?: string) => ['salary_adjustments_tenant', tenantId] as const,
  salaryAdditionals: (empId: string) => ['salary_additionals', empId] as const,
  compensationTimeline: (empId: string) => ['compensation_timeline', empId] as const,
  auditLogs: (tenantId?: string, filters?: string) => ['audit_logs', tenantId, filters] as const,
  auditLogsByEntity: (entityType: string, entityId: string) => ['audit_logs_entity', entityType, entityId] as const,
};

// ========================
// TENANT HOOKS
// ========================

export function useCreateTenant() {
  const { refreshTenants } = useTenant();
  return useMutation({
    mutationFn: (dto: CreateTenantDTO) => tenantService.create(dto),
    onSuccess: () => refreshTenants(),
  });
}

// ========================
// COMPANY GROUP HOOKS
// ========================

export function useCompanyGroups() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.companyGroups(tenantId),
    queryFn: () => companyGroupService.list(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateCompanyGroup() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyGroupDTO) => companyGroupService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companyGroups(currentTenant?.id) }),
  });
}

// ========================
// COMPANY HOOKS
// ========================

export function useCompanies() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.companies(tenantId),
    queryFn: () => companyService.list(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCompaniesSimple() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.companiesSimple(tenantId),
    queryFn: () => companyService.listSimple(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateCompany() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyDTO) => companyService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies(currentTenant?.id) }),
  });
}

// ========================
// DEPARTMENT HOOKS
// ========================

export function useDepartments() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.departments(tenantId),
    queryFn: () => departmentService.list(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateDepartment() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDepartmentDTO) => departmentService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.departments(currentTenant?.id) }),
  });
}

// ========================
// POSITION HOOKS
// ========================

export function usePositions() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.positions(tenantId),
    queryFn: () => positionService.list(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreatePosition() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePositionDTO) => positionService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.positions(currentTenant?.id) }),
  });
}

// ========================
// EMPLOYEE HOOKS
// ========================

export function useEmployees() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.employees(tenantId),
    queryFn: () => employeeService.list(tenantId!),
    enabled: !!tenantId,
  });
}

export function useEmployeesSimple() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.employeesSimple(tenantId),
    queryFn: () => employeeService.listSimple(tenantId!),
    enabled: !!tenantId,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.employee(id),
    queryFn: () => employeeService.getById(id),
    enabled: !!id,
  });
}

export function useEmployeesByGroup(groupId?: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.employeesByGroup(tenantId, groupId),
    queryFn: () => employeeService.listByGroup(tenantId!, groupId!),
    enabled: !!tenantId && !!groupId,
  });
}

export function useEmployeesByCompany(companyId?: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.employeesByCompany(tenantId, companyId),
    queryFn: () => employeeService.listByCompany(tenantId!, companyId!),
    enabled: !!tenantId && !!companyId,
  });
}

export function useCreateEmployee() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEmployeeDTO) => employeeService.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employees(currentTenant?.id) }),
  });
}

// ========================
// SALARY HISTORY HOOKS
// ========================

export function useSalaryHistoryByTenant() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.salaryHistoryTenant(tenantId),
    queryFn: () => salaryHistoryService.listByTenant(tenantId!),
    enabled: !!tenantId,
  });
}

export function useSalaryHistoryByEmployee(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.salaryHistoryEmployee(employeeId),
    queryFn: () => salaryHistoryService.listByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

// ========================
// EMPLOYEE EVENT HOOKS
// ========================

export function useEmployeeEvents(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.employeeEvents(employeeId),
    queryFn: () => employeeEventService.listByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useEmployeeEventsByTenant() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.employeeEventsTenant(tenantId),
    queryFn: () => employeeEventService.listByTenant(tenantId!),
    enabled: !!tenantId,
  });
}

// ========================
// SALARY CONTRACT HOOKS
// ========================

export function useSalaryContracts(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.salaryContracts(employeeId),
    queryFn: () => salaryContractService.listByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useActiveSalaryContract(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.salaryContractActive(employeeId),
    queryFn: () => salaryContractService.getActive(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateSalaryContract() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryContractDTO) => salaryContractService.create(dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryContracts(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.salaryContractActive(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.employees(currentTenant?.id) });
      qc.invalidateQueries({ queryKey: queryKeys.employeeEvents(vars.employee_id) });
    },
  });
}

// ========================
// SALARY ADJUSTMENT HOOKS
// ========================

export function useSalaryAdjustments(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.salaryAdjustments(employeeId),
    queryFn: () => salaryAdjustmentService.listByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useSalaryAdjustmentsByTenant() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: queryKeys.salaryAdjustmentsTenant(tenantId),
    queryFn: () => salaryAdjustmentService.listByTenant(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateSalaryAdjustment() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryAdjustmentDTO) => salaryAdjustmentService.create(dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryAdjustments(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.employees(currentTenant?.id) });
      qc.invalidateQueries({ queryKey: queryKeys.employeeEvents(vars.employee_id) });
    },
  });
}

// ========================
// SALARY ADDITIONAL HOOKS
// ========================

export function useSalaryAdditionals(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.salaryAdditionals(employeeId),
    queryFn: () => salaryAdditionalService.listByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateSalaryAdditional() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryAdditionalDTO) => salaryAdditionalService.create(dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryAdditionals(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.employeeEvents(vars.employee_id) });
    },
  });
}

// ========================
// COMPENSATION TIMELINE HOOKS
// ========================

export function useCompensationTimeline(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.compensationTimeline(employeeId),
    queryFn: () => compensationTimelineService.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

// ========================
// AUDIT LOG HOOKS
// ========================

export function useAuditLogs(opts?: { limit?: number; entity_type?: string; action?: string }) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const filterKey = JSON.stringify(opts || {});
  return useQuery({
    queryKey: queryKeys.auditLogs(tenantId, filterKey),
    queryFn: () => auditLogService.listByTenant(tenantId!, opts),
    enabled: !!tenantId,
  });
}

export function useAuditLogsByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.auditLogsByEntity(entityType, entityId),
    queryFn: () => auditLogService.listByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}
