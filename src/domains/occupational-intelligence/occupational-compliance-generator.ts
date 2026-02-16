/**
 * Occupational Compliance Generator — Orchestrator
 *
 * Full pipeline executed when a company is created/updated:
 *   1. Read CNAE (from company_cnae_profiles)
 *   2. Define risk grade (cnae-risk-mapping)
 *   3. Suggest CBOs (cbo-suggestion)
 *   4. Generate mandatory trainings (nr-training-requirement)
 *   5. Emit domain events for downstream consumers
 *
 * This is the SINGLE ENTRY POINT for occupational compliance generation.
 */

import { cnpjDataResolverService } from './cnpj-data-resolver.service';
import { cnaeRiskMappingService } from './cnae-risk-mapping.service';
import { cboSuggestionService } from './cbo-suggestion.service';
import { nrTrainingRequirementService } from './nr-training-requirement.service';
import { classifyCnae } from './cnae-risk-classifier';
import { occupationalEvents } from './occupational-compliance.events';
import { laborComplianceIntegration } from '@/domains/labor-compliance/labor-compliance-integration';
import type { ComplianceCheckResult } from '@/domains/labor-compliance/labor-compliance-integration';
import type { GrauRisco } from './types';
import type { RiskProfile } from './cnae-risk-mapping.service';
import type { CnaeCboMappingRecord } from './cbo-suggestion.service';
import type { TrainingRequirementRecord } from './nr-training-requirement.service';

// ─── Result ───

export interface ComplianceGenerationResult {
  riskProfile: RiskProfile;
  cboSuggestions: CnaeCboMappingRecord[];
  trainingRequirements: TrainingRequirementRecord[];
  complianceCheck: ComplianceCheckResult | null;
  summary: {
    grau_risco: number;
    ambiente: string;
    total_cbos_suggested: number;
    total_trainings_generated: number;
    nrs_aplicaveis: number[];
    pcmso_required: boolean;
    pgr_required: boolean;
    violations_created: string[];
  };
}

// ─── Orchestrator ───

export const occupationalComplianceGenerator = {

  /**
   * Full pipeline: CNPJ → CNAE → Risk → CBOs → Trainings → Events
   *
   * Call this when a company is created and has a CNPJ.
   */
  async generateFromCnpj(
    tenantId: string,
    companyId: string,
    companyGroupId: string | null,
    cnpj: string,
  ): Promise<ComplianceGenerationResult> {
    // 1. Resolve CNPJ → CNAE profile
    const cnaeProfile = await cnpjDataResolverService.resolveAndPersist(tenantId, companyId, cnpj);
    if (!cnaeProfile) {
      throw new Error(`Não foi possível resolver CNPJ ${cnpj}. Verifique se o CNPJ é válido.`);
    }

    // 2. Continue with CNAE code
    return this.generateFromCnae(
      tenantId,
      companyId,
      companyGroupId,
      cnaeProfile.cnae_principal,
    );
  },

  /**
   * Pipeline from CNAE code (when CNAE is already known).
   */
  async generateFromCnae(
    tenantId: string,
    companyId: string,
    companyGroupId: string | null,
    cnaeCode: string,
  ): Promise<ComplianceGenerationResult> {
    // ── Step 1: Risk Profile ──
    const riskMapping = await cnaeRiskMappingService.resolveAndPersist(tenantId, cnaeCode);
    const grauRisco = riskMapping.grau_risco as GrauRisco;

    const riskProfile: RiskProfile = {
      grau_risco: grauRisco,
      agentes_risco_provaveis: riskMapping.agentes_risco_provaveis,
      nrs_aplicaveis: riskMapping.nrs_aplicaveis,
      ambiente: riskMapping.ambiente,
      exige_pgr: riskMapping.exige_pgr,
    };

    occupationalEvents.emit({
      type: 'CompanyRiskProfileGenerated',
      timestamp: new Date().toISOString(),
      payload: {
        tenant_id: tenantId,
        company_id: companyId,
        cnae_codigo: cnaeCode,
        grau_risco: grauRisco,
        ambiente: riskProfile.ambiente,
        nrs_aplicaveis: riskProfile.nrs_aplicaveis,
        agentes_risco: riskProfile.agentes_risco_provaveis,
      },
    });

    // ── Step 2: CBO Suggestions ──
    const cboSuggestions = await cboSuggestionService.generateAndPersist(tenantId, cnaeCode);

    occupationalEvents.emit({
      type: 'CBOSuggestionsGenerated',
      timestamp: new Date().toISOString(),
      payload: {
        tenant_id: tenantId,
        company_id: companyId,
        cnae_codigo: cnaeCode,
        suggestions_count: cboSuggestions.length,
        cbo_codes: cboSuggestions.map(s => s.cbo_codigo),
      },
    });

    // ── Step 3: Training Requirements (per suggested CBO) ──
    const allTrainings: TrainingRequirementRecord[] = [];

    for (const suggestion of cboSuggestions) {
      const trainings = await nrTrainingRequirementService.generateForCompanyCbo(
        tenantId,
        companyId,
        companyGroupId,
        grauRisco,
        suggestion.cbo_codigo,
      );

      for (const t of trainings) {
        occupationalEvents.emit({
          type: 'TrainingRequirementCreated',
          timestamp: new Date().toISOString(),
          payload: {
            tenant_id: tenantId,
            company_id: companyId,
            cbo_codigo: t.cbo_codigo,
            nr_codigo: t.nr_codigo,
            catalog_item_id: t.catalog_item_id,
            obrigatorio: t.obrigatorio,
          },
        });
      }

      allTrainings.push(...trainings);
    }

    // ── Step 4: Labor Compliance Enforcement ──
    let complianceCheck: ComplianceCheckResult | null = null;
    try {
      complianceCheck = await laborComplianceIntegration.enforceForCompany(
        tenantId,
        companyId,
        grauRisco,
        riskProfile.nrs_aplicaveis,
      );
    } catch (err) {
      console.error('[ComplianceGenerator] Compliance enforcement failed:', err);
    }

    return {
      riskProfile,
      cboSuggestions,
      trainingRequirements: allTrainings,
      complianceCheck,
      summary: {
        grau_risco: grauRisco,
        ambiente: riskProfile.ambiente,
        total_cbos_suggested: cboSuggestions.length,
        total_trainings_generated: allTrainings.length,
        nrs_aplicaveis: riskProfile.nrs_aplicaveis,
        pcmso_required: complianceCheck?.pcmso_required ?? false,
        pgr_required: complianceCheck?.pgr_required ?? false,
        violations_created: complianceCheck?.violations_created ?? [],
      },
    };
  },
};
