/**
 * Employee Master Record Engine — Bounded Context
 *
 * Ficha Completa do Trabalhador (CLT, Portaria 671/2021, eSocial)
 *
 * Integrations:
 * - HR Core: employee base data
 * - Career & Legal Intelligence: CBO, PCCS
 * - Occupational Intelligence: CNAE, risk mapping
 * - NR Training Lifecycle: training requirements
 * - PCMSO / PGR: medical exams, risk exposure
 * - Payroll Simulation: cost projection
 * - Employee Agreement Engine: signed documents
 * - Fleet Compliance: vehicle assignments
 * - Government Integration Gateway: eSocial events
 * - Security Kernel: LGPD, access control
 */

// ── Services ──
export { employeeRecordService } from './employee-record.service';
export { employeePersonalDataService } from './employee-personal-data.service';
export { complianceValidationService } from './compliance-validation.service';
export type { ComplianceValidationResult, ComplianceValidationItem, ValidationSeverity } from './compliance-validation.service';
export { employeeDocumentService } from './employee-document.service';
export { employeeAddressService } from './employee-address.service';
export { employeeDependentService } from './employee-dependent.service';
export { employeeContractService } from './employee-contract.service';
export { employeeMasterRecordService } from './employee-master-record.service';

// ── Types ──
export type {
  EmployeeDocumentType,
  EmployeeDependentType,
  ContractType,
  WorkRegime,
  FgtsRegime,
  EsocialCategory,
  EmployeeRecordStatus,
  EmployeeSexo,
  EmployeeEstadoCivil,
  TipoSalario,
  FormaPagamento,
  JornadaTipo,
  EmployeeRecord,
  EmployeePersonalData,
  EmployeeDocument,
  EmployeeAddress,
  EmployeeDependent,
  EmployeeContract,
  EmployeeMasterRecord,
  CreateEmployeeRecordDTO,
  CreateEmployeePersonalDataDTO,
  CreateEmployeeDocumentDTO,
  CreateEmployeeAddressDTO,
  CreateEmployeeDependentDTO,
  CreateEmployeeContractDTO,
} from './types';

// ── Label Maps ──
export {
  RECORD_STATUS_LABELS,
  SEXO_LABELS,
  ESTADO_CIVIL_LABELS,
  DOCUMENT_TYPE_LABELS,
  DEPENDENT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_REGIME_LABELS,
  FGTS_REGIME_LABELS,
  TIPO_SALARIO_LABELS,
  FORMA_PAGAMENTO_LABELS,
  JORNADA_TIPO_LABELS,
} from './types';
