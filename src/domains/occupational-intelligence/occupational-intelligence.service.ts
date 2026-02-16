/**
 * Occupational Intelligence Service — Orchestrator
 *
 * Coordinates CNAE classification, CBO suggestion, NR mapping,
 * and compliance recommendation generation.
 *
 * Integrates with:
 * - HR Core (company/employee data)
 * - Labor Compliance (PCMSO/PGR)
 * - Labor Rules Engine (rubric mapping)
 * - Workforce Intelligence (risk scoring)
 */

import type {
  AnalyzeCompanyInput,
  OccupationalAnalysisResult,
  CnaeRiskProfile,
  OccupationalSummary,
} from './types';

import { classifyCnae, mapRiskCategories, getGrauRiscoLabel, parseCnaeDivision } from './cnae-risk-classifier';
import { suggestCbos } from './cbo-suggester';
import { getApplicableNrs, getTrainingRequirements, estimateTrainingHours } from './nr-training-mapper';
import { generateRecommendations } from './compliance-recommender';

export const occupationalIntelligenceService = {

  /**
   * Full analysis pipeline: CNAE → Risk → CBO → NR → Trainings → Recommendations
   */
  analyze(input: AnalyzeCompanyInput): OccupationalAnalysisResult {
    // 1. Classify CNAE
    const cnaeInfo = classifyCnae(input.cnae_code);
    const division = parseCnaeDivision(input.cnae_code);

    // 2. Map risk categories
    const riskCategories = mapRiskCategories(cnaeInfo.grau_risco);

    // 3. Suggest CBOs
    const suggestedCbos = suggestCbos(division);

    // 4. Get applicable NRs
    const applicableNrs = getApplicableNrs(cnaeInfo.grau_risco);
    const nrNumbers = applicableNrs.map(nr => nr.nr_number);

    // 5. Get training requirements
    const cboCodes = suggestedCbos.map(s => s.cbo.code);
    const trainingRequirements = getTrainingRequirements(cnaeInfo.grau_risco, nrNumbers, cboCodes);

    // 6. Build profile
    const profile: CnaeRiskProfile = {
      cnae: cnaeInfo,
      risk_categories: riskCategories,
      applicable_nrs: applicableNrs,
      suggested_cbos: suggestedCbos,
      training_requirements: trainingRequirements,
      compliance_score: this._calculateComplianceScore(cnaeInfo.grau_risco, applicableNrs.length),
    };

    // 7. Generate recommendations
    const recommendations = generateRecommendations(profile);

    // 8. Build summary
    const summary: OccupationalSummary = {
      total_trainings_required: trainingRequirements.length,
      total_nrs_applicable: applicableNrs.length,
      total_cbos_suggested: suggestedCbos.length,
      estimated_compliance_cost_hours: estimateTrainingHours(trainingRequirements),
      risk_level_label: getGrauRiscoLabel(cnaeInfo.grau_risco),
      requires_sesmt: cnaeInfo.requires_sesmt,
      requires_cipa: cnaeInfo.requires_cipa,
    };

    return { cnae_profile: profile, recommendations, summary };
  },

  /**
   * Quick classification without full recommendation pipeline.
   */
  classifyOnly(cnaeCode: string) {
    const cnaeInfo = classifyCnae(cnaeCode);
    const division = parseCnaeDivision(cnaeCode);
    return {
      cnae: cnaeInfo,
      risk_categories: mapRiskCategories(cnaeInfo.grau_risco),
      suggested_cbos: suggestCbos(division, 5),
      risk_label: getGrauRiscoLabel(cnaeInfo.grau_risco),
    };
  },

  _calculateComplianceScore(grau: number, nrCount: number): number {
    // Lower score = more compliance work needed
    const base = 100 - (grau * 15) - (nrCount * 2);
    return Math.max(10, Math.min(100, base));
  },
};
