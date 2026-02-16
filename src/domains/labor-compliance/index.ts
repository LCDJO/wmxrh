/**
 * LaborCompliance Bounded Context
 * 
 * Unified entry point for all labor compliance modules:
 * - SalaryStructure (versioned rubrics composition)
 * - BenefitsEngine (VA/VR/VT, health, dental plans)
 * - PCMSO/PPRA/PGR (occupational health programs & exams)
 * - RiskExposure (environmental risks, EPI, hazard pay)
 * - ComplianceRuleEngine (violation scanning & tracking)
 * - eSocial Integration (S-1000, S-2200, SST, GFIP)
 * - PayrollCatalog (rubric definitions & incidence rules)
 * 
 * This context is prepared for future extraction to microservices.
 */

// ── Occupational Intelligence Integration ──
export { laborComplianceIntegration } from './labor-compliance-integration';
export type { ComplianceCheckResult } from './labor-compliance-integration';

// ── Services ──
export { salaryStructureService } from '@/domains/compensation/salary-structure.service';
export { benefitPlanService } from '@/domains/compliance/benefit-plan.service';
export { healthProgramService } from '@/domains/compliance/health-program.service';
export { riskExposureService } from '@/domains/compliance/risk-exposure.service';
export { pcmsoAlertService } from '@/domains/compliance/pcmso-alert.service';
export { complianceRulesService } from '@/domains/compliance/compliance-rules.service';
export { payrollCatalogService } from '@/domains/compliance/payroll-catalog.service';
export { esocialEventService, ESOCIAL_EVENTS, CATEGORY_LABELS, STATUS_LABELS } from '@/domains/esocial/esocial-event.service';

// ── Types ──
export type { ExamAlertStatus, PcmsoExamAlert } from '@/domains/compliance/pcmso-alert.service';
export type { ComplianceViolation, ComplianceViolationRecord } from '@/domains/compliance/compliance-rules.service';
export type {
  SalaryStructure, SalaryStructureWithRubrics, SalaryRubric,
  CreateSalaryStructureDTO, CreateSalaryRubricDTO,
  BenefitPlan, CreateBenefitPlanDTO, EmployeeBenefit, CreateEmployeeBenefitDTO,
  HealthProgram, CreateHealthProgramDTO, EmployeeHealthExam, CreateHealthExamDTO,
  OccupationalRiskFactor, ExposureGroup,
  EmployeeRiskExposure, CreateEmployeeRiskExposureDTO,
  ESocialEvent, ESocialEventMapping, CreateESocialEventDTO,
  ESocialEventStatus, ESocialEventCategory,
} from '@/domains/shared/types';

// ── Hooks (re-exports for convenience) ──
export {
  // Salary Structure
  useSalaryStructures, useActiveSalaryStructure, useSalaryStructuresTenant,
  useCreateSalaryStructure, useAddSalaryRubric, useRemoveSalaryRubric,
  // Benefits
  useBenefitPlans, useCreateBenefitPlan, useEmployeeBenefits, useCreateEmployeeBenefit,
  // Health
  useHealthPrograms, useCreateHealthProgram, useHealthExams, useCreateHealthExam,
  useRiskFactors, useExposureGroups,
  // Risk Exposure
  useEmployeeRiskExposures, useRiskExposuresTenant, useHazardPayEmployees, useCreateRiskExposure,
  // PCMSO Alerts
  usePcmsoAlerts, usePcmsoOverdueAlerts, usePcmsoAlertCounts,
  // Compliance Rules
  useComplianceScan, useComplianceViolations, useResolveViolation,
  // Payroll Catalog
  usePayrollCatalog, useCreatePayrollCatalogItem,
  // eSocial
  useESocialEvents, useESocialStatusCounts, useESocialMappings, useCreateESocialEvent,
} from '@/domains/hooks';
