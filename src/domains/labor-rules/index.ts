/**
 * Labor Rules Engine — Bounded Context
 *
 * Centralizes Brazilian labor law rules (CLT), avoiding hardcoded logic
 * in HR and Compensation modules.
 *
 * Capabilities:
 * - Dynamic salary rule configuration
 * - Legal additionals (overtime, hazard, night shift)
 * - Collective agreement (CCT/ACT) management
 * - Mandatory validation rules
 * - eSocial rubric mapping
 * - Prepared for payroll calculation and GFIP
 */

export { laborRulesService, RULE_CATEGORY_LABELS, CALC_TYPE_LABELS } from './labor-rules.service';
export { evaluateLaborRules, summarizeRubrics } from './rule-evaluation.engine';
export { validateLaborCompliance } from './rule-compliance.validator';
export type { WorkContext, CalculatedRubric } from './rule-evaluation.engine';
export type { ComplianceValidation, ComplianceResult, ComplianceSeverity } from './rule-compliance.validator';
export type {
  LaborRuleCategory, LaborRuleCalcType,
  LaborRuleSet, LaborRuleSetWithRules, LaborRuleDefinition,
  CollectiveAgreement, CollectiveAgreementWithClauses, CollectiveAgreementClause,
  CollectiveAgreementType, CollectiveAgreementStatus,
  CreateLaborRuleSetDTO, CreateLaborRuleDefinitionDTO,
  CreateCollectiveAgreementDTO, CreateCollectiveAgreementClauseDTO,
} from './types';
