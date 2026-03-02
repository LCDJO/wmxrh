/**
 * WorkforceOperationsEngine — Payroll Simulation Domain
 *
 * Facade over the existing payroll-simulation domain.
 */

export {
  simulatePayroll,
  payrollSimulationService,
  calculateTaxes, calculateInss, calculateIrrf, calculateFgts,
  calculateReflections,
  calculateEmployerCost,
} from '@/domains/payroll-simulation';

export type {
  SimulationInput,
  PayrollSimulationOutput,
  TaxResult,
  ReflectionResult,
  EmployerCostResult,
} from '@/domains/payroll-simulation';
