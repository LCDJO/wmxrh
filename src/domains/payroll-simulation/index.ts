/**
 * Payroll Simulation Engine — Bounded Context
 *
 * Simulates CLT compensation calculations without generating
 * official payroll. Projects taxes, reflections, and employer costs.
 *
 * Capabilities:
 * - Monthly CLT compensation simulation
 * - Progressive INSS/IRRF calculation
 * - Labor reflections (férias, 13º, FGTS provisions)
 * - Total employer cost projection with cost multiplier
 * - Financial analysis for HR decision-making
 *
 * Dependencies:
 * - LaborRulesEngine (rubric evaluation)
 */

export { simulatePayroll } from './payroll-simulation.engine';
export { payrollSimulationService } from './payroll-simulation.service';
export type { WorkDataOverrides, PayrollSimulationRecord } from './payroll-simulation.service';
export { calculateTaxes, calculateInss, calculateIrrf, calculateFgts } from './tax-calculator';
export { calculateReflections } from './reflection-calculator';
export { calculateEmployerCost } from './employer-cost-calculator';

export type {
  SimulationInput,
  PayrollSimulationOutput,
  TaxResult,
  InssBreakdown,
  ReflectionResult,
  EmployerCostResult,
  EncargoEstimate,
} from './types';
