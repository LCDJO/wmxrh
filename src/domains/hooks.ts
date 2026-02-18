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
import { salaryStructureService } from '@/domains/compensation/salary-structure.service';
import { riskExposureService } from '@/domains/compliance/risk-exposure.service';
import { pcmsoAlertService, type ExamAlertStatus } from '@/domains/compliance/pcmso-alert.service';
import { complianceRulesService } from '@/domains/compliance/compliance-rules.service';
import { supabase } from '@/integrations/supabase/client';
import { laborRulesService } from '@/domains/labor-rules/labor-rules.service';
import type {
  CreateLaborRuleSetDTO, CreateLaborRuleDefinitionDTO,
  CreateCollectiveAgreementDTO, CreateCollectiveAgreementClauseDTO,
} from '@/domains/labor-rules/types';
// Types
import type {
  CreateTenantDTO, CreateCompanyGroupDTO, CreateCompanyDTO,
  CreateDepartmentDTO, CreatePositionDTO, CreateEmployeeDTO,
  CreateSalaryContractDTO, CreateSalaryAdjustmentDTO, CreateSalaryAdditionalDTO,
  CreatePayrollItemCatalogDTO, CreateBenefitPlanDTO, CreateEmployeeBenefitDTO,
  CreateHealthProgramDTO, CreateHealthExamDTO,
  CreateSalaryStructureDTO, CreateSalaryRubricDTO,
  CreateEmployeeRiskExposureDTO,
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
  // Salary Composition
  salaryStructures: (empId: string) => ['salary_structures', empId] as const,
  salaryStructureActive: (empId: string) => ['salary_structure_active', empId] as const,
  salaryStructuresTenant: (tenantId?: string) => ['salary_structures_tenant', tenantId] as const,
  // Labor Rules Engine
  laborRuleSets: (tenantId?: string) => ['labor_rule_sets', tenantId] as const,
  laborRuleDefinitions: (ruleSetId: string) => ['labor_rule_definitions', ruleSetId] as const,
  collectiveAgreements: (tenantId?: string) => ['collective_agreements', tenantId] as const,
  // Salary Rubric Templates
  salaryRubricTemplates: (tenantId?: string) => ['salary_rubric_templates', tenantId] as const,
  documentVault: (empId: string) => ['document_vault', empId] as const,
  // NR Training
  nrTrainingAssignments: (tenantId?: string) => ['nr_training_assignments', tenantId] as const,
  nrTrainingByEmployee: (empId: string) => ['nr_training_employee', empId] as const,
  restrictedEmployees: (tenantId?: string) => ['restricted_employees', tenantId] as const,
  companyCnaeProfiles: (tenantId?: string) => ['company_cnae_profiles', tenantId] as const,
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

export function useUpdateCompanyGroup() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => companyGroupService.update(id, dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companyGroups(qs?.tenantId) }),
  });
}

export function useDeleteCompanyGroup() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyGroupService.softDelete(id, qs!),
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

export function useUpdateCompany() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => companyService.update(id, dto, qs!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.companiesSimple(qs?.tenantId) });
    },
  });
}

export function useDeleteCompany() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyService.softDelete(id, qs!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.companiesSimple(qs?.tenantId) });
    },
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

export function useUpdateDepartment() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => departmentService.update(id, dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.departments(qs?.tenantId) }),
  });
}

export function useDeleteDepartment() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentService.softDelete(id, qs!),
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

export function useUpdatePosition() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => positionService.update(id, dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.positions(qs?.tenantId) }),
  });
}

export function useDeletePosition() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => positionService.softDelete(id, qs!),
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

export function useUpdateEmployee() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => employeeService.update(id, dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.employee(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.employees(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.employeesSimple(qs?.tenantId) });
    },
  });
}

export function useDeleteEmployee() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeService.softDelete(id, qs!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employees(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: queryKeys.employeesSimple(qs?.tenantId) });
    },
  });
}

export function useUpdateBenefitPlan() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => benefitPlanService.updatePlan(id, dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.benefitPlans(qs?.tenantId) }),
  });
}

export function useDeleteBenefitPlan() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => benefitPlanService.softDeletePlan(id, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.benefitPlans(qs?.tenantId) }),
  });
}

export function useUpdateHealthProgram() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Record<string, unknown>) => healthProgramService.updateProgram(id, dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.healthPrograms(qs?.tenantId) }),
  });
}

export function useDeleteHealthProgram() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => healthProgramService.deleteProgram(id, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.healthPrograms(qs?.tenantId) }),
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

// ========================
// SALARY COMPOSITION ENGINE
// ========================

export function useSalaryStructures(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryStructures(employeeId),
    queryFn: () => salaryStructureService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useActiveSalaryStructure(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryStructureActive(employeeId),
    queryFn: () => salaryStructureService.getActive(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useSalaryStructuresTenant() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryStructuresTenant(qs?.tenantId),
    queryFn: () => salaryStructureService.listByTenant(qs!),
    enabled: !!qs,
  });
}

export function useCreateSalaryStructure() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryStructureDTO) => salaryStructureService.create(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.salaryStructures(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.salaryStructureActive(vars.employee_id) });
      qc.invalidateQueries({ queryKey: queryKeys.salaryStructuresTenant(qs?.tenantId) });
    },
  });
}

export function useAddSalaryRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalaryRubricDTO) => salaryStructureService.addRubric(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary_structures'] });
      qc.invalidateQueries({ queryKey: ['salary_structure_active'] });
      qc.invalidateQueries({ queryKey: ['salary_structures_tenant'] });
    },
  });
}

export function useRemoveSalaryRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rubricId: string) => salaryStructureService.removeRubric(rubricId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary_structures'] });
      qc.invalidateQueries({ queryKey: ['salary_structure_active'] });
    },
  });
}

// ========================
// RISK EXPOSURE
// ========================

const riskExposureKeys = {
  byEmployee: (employeeId?: string) => ['employee_risk_exposures', employeeId],
  byTenant: (tenantId?: string) => ['employee_risk_exposures_tenant', tenantId],
  hazardPay: (tenantId?: string) => ['hazard_pay_employees', tenantId],
};

export function useEmployeeRiskExposures(employeeId?: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: riskExposureKeys.byEmployee(employeeId),
    queryFn: () => riskExposureService.listByEmployee(employeeId!, qs!),
    enabled: !!employeeId && !!qs,
  });
}

export function useRiskExposuresTenant() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: riskExposureKeys.byTenant(qs?.tenantId),
    queryFn: () => riskExposureService.listByTenant(qs!),
    enabled: !!qs,
  });
}

export function useHazardPayEmployees() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: riskExposureKeys.hazardPay(qs?.tenantId),
    queryFn: () => riskExposureService.listHazardPayEmployees(qs!),
    enabled: !!qs,
  });
}

export function useCreateRiskExposure() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEmployeeRiskExposureDTO) => riskExposureService.create(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: riskExposureKeys.byEmployee(vars.employee_id) });
      qc.invalidateQueries({ queryKey: riskExposureKeys.byTenant(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: riskExposureKeys.hazardPay(qs?.tenantId) });
    },
  });
}

// ========================
// PCMSO ALERTS
// ========================

const pcmsoKeys = {
  alerts: (tenantId?: string, statuses?: string) => ['pcmso_alerts', tenantId, statuses],
  counts: (tenantId?: string) => ['pcmso_alert_counts', tenantId],
};

export function usePcmsoAlerts(statuses?: ExamAlertStatus[]) {
  const qs = useQueryScope();
  const key = statuses?.join(',');
  return useQuery({
    queryKey: pcmsoKeys.alerts(qs?.tenantId, key),
    queryFn: () => pcmsoAlertService.listAlerts(qs!.tenantId, statuses),
    enabled: !!qs,
  });
}

export function usePcmsoOverdueAlerts() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: pcmsoKeys.alerts(qs?.tenantId, 'overdue_expiring'),
    queryFn: () => pcmsoAlertService.listOverdueAndExpiring(qs!.tenantId),
    enabled: !!qs,
  });
}

export function usePcmsoAlertCounts() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: pcmsoKeys.counts(qs?.tenantId),
    queryFn: () => pcmsoAlertService.countByStatus(qs!.tenantId),
    enabled: !!qs,
  });
}

// ========================
// COMPLIANCE RULES ENGINE
// ========================

const complianceKeys = {
  scan: (tenantId?: string) => ['compliance_scan', tenantId],
  violations: (tenantId?: string) => ['compliance_violations', tenantId],
};

export function useComplianceScan() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: complianceKeys.scan(qs?.tenantId),
    queryFn: () => complianceRulesService.scanViolations(qs!.tenantId),
    enabled: !!qs,
  });
}

export function useComplianceViolations(onlyUnresolved = true) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: [...complianceKeys.violations(qs?.tenantId), onlyUnresolved],
    queryFn: () => complianceRulesService.listTrackedViolations(qs!.tenantId, onlyUnresolved),
    enabled: !!qs,
  });
}

export function useResolveViolation() {
  const qc = useQueryClient();
  const qs = useQueryScope();
  return useMutation({
    mutationFn: ({ id, resolvedBy }: { id: string; resolvedBy: string }) =>
      complianceRulesService.resolveViolation(id, resolvedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: complianceKeys.violations(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: complianceKeys.scan(qs?.tenantId) });
    },
  });
}

// ========================
// eSocial EVENT HOOKS
// ========================

import { esocialEventService } from '@/domains/esocial/esocial-event.service';
import type { ESocialEventStatus, ESocialEventCategory, CreateESocialEventDTO } from '@/domains/shared/types';

const esocialKeys = {
  events: (tenantId?: string, filters?: string) => ['esocial_events', tenantId, filters] as const,
  statusCounts: (tenantId?: string) => ['esocial_status_counts', tenantId] as const,
  mappings: (tenantId?: string) => ['esocial_mappings', tenantId] as const,
};

export function useESocialEvents(opts?: { status?: ESocialEventStatus; category?: ESocialEventCategory; event_type?: string; reference_period?: string; limit?: number }) {
  const qs = useQueryScope();
  const filterKey = JSON.stringify(opts || {});
  return useQuery({
    queryKey: esocialKeys.events(qs?.tenantId, filterKey),
    queryFn: () => esocialEventService.list(qs!, opts),
    enabled: !!qs,
  });
}

export function useESocialStatusCounts() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: esocialKeys.statusCounts(qs?.tenantId),
    queryFn: () => esocialEventService.getStatusCounts(qs!),
    enabled: !!qs,
  });
}

export function useESocialMappings() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: esocialKeys.mappings(qs?.tenantId),
    queryFn: () => esocialEventService.listMappings(qs!),
    enabled: !!qs,
  });
}

export function useCreateESocialEvent() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateESocialEventDTO) => esocialEventService.create(dto, qs!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: esocialKeys.events(qs?.tenantId) });
      qc.invalidateQueries({ queryKey: esocialKeys.statusCounts(qs?.tenantId) });
    },
  });
}

// ========================
// LABOR RULES ENGINE
// ========================

const laborRulesKeys = {
  ruleSets: (tenantId?: string) => queryKeys.laborRuleSets(tenantId),
  ruleDefinitions: (ruleSetId: string) => queryKeys.laborRuleDefinitions(ruleSetId),
  agreements: (tenantId?: string) => queryKeys.collectiveAgreements(tenantId),
};

export function useLaborRuleSets() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: laborRulesKeys.ruleSets(qs?.tenantId),
    queryFn: () => laborRulesService.listRuleSets(qs!),
    enabled: !!qs,
  });
}

export function useLaborRuleDefinitions(ruleSetId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: laborRulesKeys.ruleDefinitions(ruleSetId),
    queryFn: () => laborRulesService.listRuleDefinitions(ruleSetId, qs!),
    enabled: !!ruleSetId && !!qs,
  });
}

export function useCreateLaborRuleSet() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLaborRuleSetDTO) => laborRulesService.createRuleSet(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: laborRulesKeys.ruleSets(qs?.tenantId) }),
  });
}

export function useCreateLaborRuleDefinition() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLaborRuleDefinitionDTO) => laborRulesService.createRuleDefinition(dto, qs!),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: laborRulesKeys.ruleDefinitions(vars.rule_set_id) });
      qc.invalidateQueries({ queryKey: laborRulesKeys.ruleSets(qs?.tenantId) });
    },
  });
}

export function useCollectiveAgreements() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: laborRulesKeys.agreements(qs?.tenantId),
    queryFn: () => laborRulesService.listAgreements(qs!),
    enabled: !!qs,
  });
}

export function useCreateCollectiveAgreement() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCollectiveAgreementDTO) => laborRulesService.createAgreement(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: laborRulesKeys.agreements(qs?.tenantId) }),
  });
}

export function useCreateAgreementClause() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCollectiveAgreementClauseDTO) => laborRulesService.createClause(dto, qs!),
    onSuccess: () => qc.invalidateQueries({ queryKey: laborRulesKeys.agreements(qs?.tenantId) }),
  });
}

// ========================
// SALARY RUBRIC TEMPLATES
// ========================

export function useSalaryRubricTemplates() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.salaryRubricTemplates(qs?.tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_rubric_templates' as any)
        .select('*')
        .eq('tenant_id', qs!.tenantId)
        .order('codigo');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!qs,
  });
}

// ========================
// DOCUMENT VAULT
// ========================

import { documentVaultService } from '@/domains/employee-agreement/document-vault.service';
import type { DocumentVaultRecord } from '@/domains/employee-agreement/document-vault.service';

export function useDocumentVault(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.documentVault(employeeId),
    queryFn: () => documentVaultService.listByEmployee(employeeId, qs!),
    enabled: !!employeeId && !!qs,
  });
}

// ========================
// NR TRAINING HOOKS
// ========================

export function useNrTrainingAssignments() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.nrTrainingAssignments(qs?.tenantId),
    queryFn: async () => {
      let q = supabase
        .from('nr_training_assignments')
        .select('*, employees(name, company_id)')
        .eq('tenant_id', qs!.tenantId)
        .order('updated_at', { ascending: false });
      if (qs!.companyId) q = q.eq('company_id', qs!.companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!qs,
  });
}

export function useNrTrainingByEmployee(employeeId: string) {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.nrTrainingByEmployee(employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nr_training_assignments')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', qs!.tenantId)
        .order('nr_number');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!qs,
  });
}

export function useRestrictedEmployees() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.restrictedEmployees(qs?.tenantId),
    queryFn: async () => {
      let q = supabase
        .from('employees')
        .select('id, name, company_id, department_id, position_id, operacao_restrita, restricao_motivo')
        .eq('tenant_id', qs!.tenantId)
        .eq('operacao_restrita', true);
      if (qs!.companyId) q = q.eq('company_id', qs!.companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!qs,
  });
}

export function useCompanyCnaeProfiles() {
  const qs = useQueryScope();
  return useQuery({
    queryKey: queryKeys.companyCnaeProfiles(qs?.tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_cnae_profiles')
        .select('company_id, cnae_principal, descricao_atividade, grau_risco_sugerido')
        .eq('tenant_id', qs!.tenantId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!qs,
  });
}
