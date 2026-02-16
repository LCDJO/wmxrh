/**
 * Domain Hooks - React Query hooks per bounded context
 * 
 * All hooks use QueryScope for automatic data isolation:
 *   - tenant_id always from context (never from params)
 *   - scope filters (group/company) applied automatically
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import type { QueryScope } from '@/domains/shared/scoped-query';

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
import { payrollCatalogService } from '@/domains/compliance/payroll-catalog.service';
import { benefitPlanService } from '@/domains/compliance/benefit-plan.service';
import { healthProgramService } from '@/domains/compliance/health-program.service';
import { payrollSimulationService } from '@/domains/compliance/payroll-simulation.service';

// Types
import type {
  CreateTenantDTO, CreateCompanyGroupDTO, CreateCompanyDTO,
  CreateDepartmentDTO, CreatePositionDTO, CreateEmployeeDTO,
  CreateSalaryContractDTO, CreateSalaryAdjustmentDTO, CreateSalaryAdditionalDTO,
  CreatePayrollItemCatalogDTO, CreateBenefitPlanDTO, CreateEmployeeBenefitDTO,
  CreateHealthProgramDTO, CreateHealthExamDTO,
} from '@/domains/shared';

// ========================
// SCOPE HELPER — builds QueryScope from contexts
// ========================

export function useQueryScope(): QueryScope | null {
  const { currentTenant } = useTenant();
  const { scope, userRoles } = useScope();
  
  if (!currentTenant) return null;

  return {
    tenantId: currentTenant.id,
    userRoles,
    scopeLevel: scope.level === 'tenant' ? 'tenant' : scope.level === 'group' ? 'company_group' : 'company',
    groupId: scope.groupId,
    companyId: scope.companyId,
  };
}

// ========================
// QUERY KEYS (centralized for cache management)
// ========================

export const queryKeys = {
  employees: (tenantId?: string) => ['employees', tenantId] as const,
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
  // Compliance
  payrollCatalog: (tenantId?: string) => ['payroll_catalog', tenantId] as const,
  benefitPlans: (tenantId?: string) => ['benefit_plans', tenantId] as const,
  employeeBenefits: (empId: string) => ['employee_benefits', empId] as const,
  healthPrograms: (tenantId?: string) => ['health_programs', tenantId] as const,
  healthExams: (tenantId?: string) => ['health_exams', tenantId] as const,
  employeeHealthExams: (empId: string) => ['employee_health_exams', empId] as const,
  riskFactors: (tenantId?: string) => ['risk_factors', tenantId] as const,
  exposureGroups: (tenantId?: string) => ['exposure_groups', tenantId] as const,
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
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.companyGroups(qs?.tenantId),
    queryFn: () => companyGroupService.list(qs!),
    enabled: !!qs,
  });
}

export function useCreateCompanyGroup() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyGroupDTO) => companyGroupService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companyGroups(qs?.tenantId) }),
  });
}

// ========================
// COMPANY HOOKS
// ========================

export function useCompanies() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.companies(qs?.tenantId),
    queryFn: () => companyService.list(qs!),
    enabled: !!qs,
  });
}

export function useCompaniesSimple() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.companiesSimple(qs?.tenantId),
    queryFn: () => companyService.listSimple(qs!),
    enabled: !!qs,
  });
}

export function useCreateCompany() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompanyDTO) => companyService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies(qs?.tenantId) }),
  });
}

// ========================
// DEPARTMENT HOOKS
// ========================

export function useDepartments() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.departments(qs?.tenantId),
    queryFn: () => departmentService.list(qs!),
    enabled: !!qs,
  });
}

export function useCreateDepartment() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDepartmentDTO) => departmentService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.departments(qs?.tenantId) }),
  });
}

// ========================
// POSITION HOOKS
// ========================

export function usePositions() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.positions(qs?.tenantId),
    queryFn: () => positionService.list(qs!),
    enabled: !!qs,
  });
}

export function useCreatePosition() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePositionDTO) => positionService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.positions(qs?.tenantId) }),
  });
}

// ========================
// EMPLOYEE HOOKS
// ========================

export function useEmployees() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employees(qs?.tenantId),
    queryFn: () => employeeService.list(qs!),
    enabled: !!qs,
  });
}

export function useEmployeesSimple() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employeesSimple(qs?.tenantId),
    queryFn: () => employeeService.listSimple(qs!),
    enabled: !!qs,
  });
}

export function useEmployee(id: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employee(id),
    queryFn: () => employeeService.getById(id, qs!),
    enabled: !!id && !!qs,
  });
}

export function useCreateEmployee() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEmployeeDTO) => employeeService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employees(qs?.tenantId) }),
  });
}

// ========================
// SALARY HISTORY HOOKS
// ========================

export function useSalaryHistoryByTenant() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryHistoryTenant(qs?.tenantId),
    queryFn: () => salaryHistoryService.listByTenant(qs!),
    enabled: !!qs,
  });
}

export function useSalaryHistoryByEmployee(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryHistoryEmployee(employeeId),
    queryFn: () => salaryHistoryService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

// ========================
// EMPLOYEE EVENT HOOKS
// ========================

export function useEmployeeEvents(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employeeEvents(employeeId),
    queryFn: () => employeeEventService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useEmployeeEventsByTenant() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employeeEventsTenant(qs?.tenantId),
    queryFn: () => employeeEventService.listByTenant(qs!),
    enabled: !!qs,
  });
}

// ========================
// SALARY CONTRACT HOOKS
// ========================

export function useSalaryContracts(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryContracts(employeeId),
    queryFn: () => salaryContractService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useActiveSalaryContract(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryContractActive(employeeId),
    queryFn: () => salaryContractService.getActive(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useCreateSalaryContract() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryContractDTO) => salaryContractService.create(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryContracts(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.salaryContractActive(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.employees(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.employeeEvents(vars.employee_id) });
    },
  });
}

// ========================
// SALARY ADJUSTMENT HOOKS
// ========================

export function useSalaryAdjustments(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryAdjustments(employeeId),
    queryFn: () => salaryAdjustmentService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useSalaryAdjustmentsByTenant() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryAdjustmentsTenant(qs?.tenantId),
    queryFn: () => salaryAdjustmentService.listByTenant(qs!),
    enabled: !!qs,
  });
}

export function useCreateSalaryAdjustment() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryAdjustmentDTO) => salaryAdjustmentService.create(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryAdjustments(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.employees(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.employeeEvents(vars.employee_id) });
    },
  });
}

// ========================
// SALARY ADDITIONAL HOOKS
// ========================

export function useSalaryAdditionals(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryAdditionals(employeeId),
    queryFn: () => salaryAdditionalService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useCreateSalaryAdditional() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryAdditionalDTO) => salaryAdditionalService.create(dto, qs!),
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
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.compensationTimeline(employeeId),
    queryFn: () => compensationTimelineService.getByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

// ========================
// AUDIT LOG HOOKS
// ========================

export function useAuditLogs(opts?: { limit?: number; entity_type?: string; action?: string }) {
  const qs = useQueryScope();
  const filterKey = JSON.stringify(opts || {});
  return useQuery({
    queryKey: queryKeys.auditLogs(qs?.tenantId, filterKey),
    queryFn: () => auditLogService.listByTenant(qs!, opts),
    enabled: !!qs,
  });
}

export function useAuditLogsByEntity(entityType: string, entityId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.auditLogsByEntity(entityType, entityId),
    queryFn: () => auditLogService.listByEntity(entityType, entityId, qs!),
    enabled: !!entityType && !!entityId && !!qs,
  });
}

// ========================
// COMPLIANCE — PAYROLL CATALOG
// ========================

export function usePayrollCatalog() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.payrollCatalog(qs?.tenantId),
    queryFn: () => payrollCatalogService.list(qs!),
    enabled: !!qs,
  });
}

export function useCreatePayrollCatalogItem() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePayrollItemCatalogDTO) => payrollCatalogService.create(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payrollCatalog(qs?.tenantId) }),
  });
}

// ========================
// COMPLIANCE — BENEFIT PLANS
// ========================

export function useBenefitPlans() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.benefitPlans(qs?.tenantId),
    queryFn: () => benefitPlanService.listPlans(qs!),
    enabled: !!qs,
  });
}

export function useCreateBenefitPlan() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBenefitPlanDTO) => benefitPlanService.createPlan(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.benefitPlans(qs?.tenantId) }),
  });
}

export function useEmployeeBenefits(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.employeeBenefits(employeeId),
    queryFn: () => benefitPlanService.listEmployeeBenefits(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useCreateEmployeeBenefit() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEmployeeBenefitDTO) => benefitPlanService.createEmployeeBenefit(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.employeeBenefits(vars.employee_id) });
    },
  });
}

// ========================
// COMPLIANCE — HEALTH PROGRAMS & EXAMS
// ========================

export function useHealthPrograms() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.healthPrograms(qs?.tenantId),
    queryFn: () => healthProgramService.listPrograms(qs!),
    enabled: !!qs,
  });
}

export function useCreateHealthProgram() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateHealthProgramDTO) => healthProgramService.createProgram(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.healthPrograms(qs?.tenantId) }),
  });
}

export function useHealthExams(employeeId?: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: employeeId ? queryKeys.employeeHealthExams(employeeId) : queryKeys.healthExams(qs?.tenantId),
    queryFn: () => healthProgramService.listExams(qs!, employeeId),
    enabled: !!qs,
  });
}

export function useCreateHealthExam() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateHealthExamDTO) => healthProgramService.createExam(dto, qs!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.healthExams(qs?.tenantId) });
    },
  });
}

export function useRiskFactors() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.riskFactors(qs?.tenantId),
    queryFn: () => healthProgramService.listRiskFactors(qs!),
    enabled: !!qs,
  });
}

export function useExposureGroups() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.exposureGroups(qs?.tenantId),
    queryFn: () => healthProgramService.listExposureGroups(qs!),
    enabled: !!qs,
  });
}

// ========================
// COMPLIANCE — PAYROLL SIMULATION
// ========================

export function usePayrollSimulation(baseSalary: number, referenceDate?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['payroll_simulation', currentTenant?.id, baseSalary, referenceDate],
    queryFn: () => payrollSimulationService.simulate(currentTenant!.id, baseSalary, referenceDate),
    enabled: !!currentTenant && baseSalary > 0,
  });
}
