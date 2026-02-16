/**
 * Occupational Intelligence Engine — Bounded Context
 *
 * Analyzes company CNAE codes to map occupational risks,
 * suggest compatible CBOs, and identify NR training requirements.
 *
 * Integrations:
 * - HR Core: company/employee data
 * - Labor Compliance: PCMSO/PGR programs
 * - Labor Rules Engine: rubric legal basis
 * - Workforce Intelligence: risk scoring
 */

export { occupationalIntelligenceService } from './occupational-intelligence.service';
export { classifyCnae, mapRiskCategories, getGrauRiscoLabel, parseCnaeDivision } from './cnae-risk-classifier';
export { suggestCbos, getCboByCode } from './cbo-suggester';
export { getApplicableNrs, getTrainingRequirements, estimateTrainingHours } from './nr-training-mapper';
export { generateRecommendations } from './compliance-recommender';
export { cnpjDataResolverService } from './cnpj-data-resolver.service';
export type { CompanyCNAEProfile, ResolvedCNPJData, UpsertCNAEProfileDTO } from './cnpj-data-resolver.service';
export { cnaeRiskMappingService } from './cnae-risk-mapping.service';
export type { CnaeRiskMapping, RiskProfile, UpsertCnaeRiskMappingDTO } from './cnae-risk-mapping.service';
export { cboSuggestionService } from './cbo-suggestion.service';
export type { CboCatalogRecord, CnaeCboMappingRecord } from './cbo-suggestion.service';
export { nrTrainingRequirementService } from './nr-training-requirement.service';
export type { NrTrainingCatalogRecord, TrainingRequirementRecord } from './nr-training-requirement.service';
export { occupationalComplianceGenerator } from './occupational-compliance-generator';
export type { ComplianceGenerationResult } from './occupational-compliance-generator';
export { occupationalEvents } from './occupational-compliance.events';
export type { CompanyRiskProfileGeneratedEvent, CBOSuggestionsGeneratedEvent, TrainingRequirementCreatedEvent, OccupationalComplianceEvent } from './occupational-compliance.events';
export { externalDataService } from './external-data.service';
export type { ExternalCnpjResult, CnaeDivision, NrVersionInfo } from './external-data.service';

export type {
  GrauRisco,
  CnaeInfo,
  CnaeRiskProfile,
  CboInfo,
  CboSuggestion,
  NrPriority,
  TrainingPeriodicity,
  NrRequirement,
  TrainingRequirement,
  OccupationalRiskType,
  RiskCategoryMapping,
  RecommendationSeverity,
  RecommendationStatus,
  ComplianceRecommendation,
  AnalyzeCompanyInput,
  OccupationalAnalysisResult,
  OccupationalSummary,
} from './types';
