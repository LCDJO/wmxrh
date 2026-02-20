/**
 * Career → PCMSO Integration Service
 *
 * When a career position has associated occupational risks:
 * 1. Creates a standard medical profile (via career_legal_requirements)
 * 2. Defines periodic exams (ASO + risk-specific)
 * 3. Generates automatic risk alerts
 *
 * Emits: CareerPositionMedicalProfileGenerated
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import { suggestLegalRequirements } from './career-compliance.engine';
import { legalRequirementsService } from './legal-requirements.service';
import { riskAlertService } from './risk-alert.service';
import { emitCareerEvent } from './career-intelligence.events';
import type {
  CareerPosition,
  CareerLegalMapping,
  CareerLegalRequirement,
  CareerRiskAlert,
} from './types';

// ── Types ──

export interface MedicalProfileResult {
  position_id: string;
  generated_requirements: CareerLegalRequirement[];
  generated_alerts: CareerRiskAlert[];
  risk_grade: number;
  applicable_nrs: number[];
}

// ── Pure helpers ──

/** Derive risk grade from legal mappings (max of adicional → 4, exame_medico → 3, etc.) */
function deriveRiskGrade(mappings: CareerLegalMapping[]): number {
  let grade = 1;
  for (const m of mappings) {
    if (m.adicional_aplicavel === 'insalubridade' || m.adicional_aplicavel === 'periculosidade') grade = Math.max(grade, 4);
    if (m.exige_exame_medico) grade = Math.max(grade, 3);
    if (m.exige_epi) grade = Math.max(grade, 3);
    if (m.exige_treinamento) grade = Math.max(grade, 2);
  }
  return grade;
}

/** Extract unique NR codes as numbers from mappings */
function extractNrCodes(mappings: CareerLegalMapping[]): number[] {
  const codes = new Set<number>();
  for (const m of mappings) {
    if (m.nr_codigo) {
      const num = parseInt(m.nr_codigo.replace(/\D/g, ''), 10);
      if (!isNaN(num)) codes.add(num);
    }
  }
  return [...codes].sort((a, b) => a - b);
}

// ── Service ──

export const careerPcmsoIntegrationService = {
  /**
   * Main entry-point: given a position and its legal mappings,
   * generate the medical profile (requirements + alerts).
   */
  async generateMedicalProfile(
    position: CareerPosition,
    scope: QueryScope
  ): Promise<MedicalProfileResult> {
    // 1. Fetch legal mappings for position
    const { data: mappings, error: mErr } = await supabase
      .from('career_legal_mappings')
      .select('*')
      .eq('career_position_id', position.id)
      .eq('tenant_id', scope.tenantId);
    if (mErr) throw mErr;

    const legalMappings = (mappings || []) as unknown as CareerLegalMapping[];

    // Skip if no risk-associated mappings
    const hasRisk = legalMappings.some(
      m => m.exige_exame_medico || m.exige_epi || m.adicional_aplicavel != null
    );
    if (!hasRisk) {
      return {
        position_id: position.id,
        generated_requirements: [],
        generated_alerts: [],
        risk_grade: 1,
        applicable_nrs: [],
      };
    }

    // 2. Derive risk parameters
    const riskGrade = deriveRiskGrade(legalMappings);
    const applicableNrs = extractNrCodes(legalMappings);

    // 3. Generate standard medical requirements via compliance engine
    const suggestions = suggestLegalRequirements(position.cbo_codigo, riskGrade, applicableNrs);

    // 4. Fetch existing requirements to avoid duplicates
    const { data: existing } = await supabase
      .from('career_legal_requirements')
      .select('codigo_referencia, tipo')
      .eq('career_position_id', position.id)
      .eq('tenant_id', scope.tenantId);
    const existingKeys = new Set(
      (existing || []).map((e: { codigo_referencia: string | null; tipo: string }) => `${e.tipo}:${e.codigo_referencia}`)
    );

    // 5. Insert only new requirements
    const newSuggestions = suggestions.filter(
      s => !existingKeys.has(`${s.tipo}:${s.codigo_referencia}`)
    );

    const createdRequirements: CareerLegalRequirement[] = [];
    for (const s of newSuggestions) {
      const req = await legalRequirementsService.create(
        {
          tenant_id: scope.tenantId,
          career_position_id: position.id,
          ...s,
        },
        scope
      );
      createdRequirements.push(req);
    }

    // 6. Generate risk alert for positions with high risk
    const createdAlerts: CareerRiskAlert[] = [];
    if (riskGrade >= 3) {
      const alert = await riskAlertService.create(
        {
          tenant_id: scope.tenantId,
          career_position_id: position.id,
          tipo_alerta: 'exame_vencido',
          severidade: riskGrade >= 4 ? 'critico' : 'alto',
          descricao: `Cargo "${position.nome}" possui grau de risco ${riskGrade}. Perfil médico PCMSO gerado automaticamente — verificar exames periódicos.`,
          metadata: {
            risk_grade: riskGrade,
            applicable_nrs: applicableNrs,
            auto_generated: true,
          },
        },
        scope
      );
      createdAlerts.push(alert);
    }

    // 7. Emit domain event
    emitCareerEvent('career:position_medical_profile_generated', {
      position_id: position.id,
      tenant_id: scope.tenantId,
      risk_grade: riskGrade,
      requirements_count: createdRequirements.length,
      alerts_count: createdAlerts.length,
    });

    return {
      position_id: position.id,
      generated_requirements: createdRequirements,
      generated_alerts: createdAlerts,
      risk_grade: riskGrade,
      applicable_nrs: applicableNrs,
    };
  },
};
