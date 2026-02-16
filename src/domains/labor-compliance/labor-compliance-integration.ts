/**
 * Labor Compliance Integration
 *
 * Bridges the Occupational Intelligence engine with Labor Compliance:
 *
 * 1. If grau_risco >= 2 → ensure PCMSO and PGR programs exist (create violations if missing)
 * 2. If NR requires medical exams → create PCMSO exam reminders
 *
 * Listens to CompanyRiskProfileGenerated events from the orchestrator.
 */

import { supabase } from '@/integrations/supabase/client';
import { occupationalEvents } from '@/domains/occupational-intelligence/occupational-compliance.events';
import type { CompanyRiskProfileGeneratedEvent } from '@/domains/occupational-intelligence/occupational-compliance.events';
import type { GrauRisco } from '@/domains/occupational-intelligence/types';

// NRs that mandate medical exams (ASO) via PCMSO
const NRS_REQUIRING_MEDICAL_EXAM = [7, 9, 10, 15, 16, 32, 33, 35];

// ─── Types ───

export interface ComplianceCheckResult {
  pcmso_required: boolean;
  pgr_required: boolean;
  pcmso_exists: boolean;
  pgr_exists: boolean;
  violations_created: string[];
  pcmso_reminders_created: number;
}

// ─── Service ───

export const laborComplianceIntegration = {

  /**
   * Check and enforce compliance requirements based on risk grade.
   * Creates compliance violations if mandatory programs are missing.
   */
  async enforceForCompany(
    tenantId: string,
    companyId: string,
    grauRisco: GrauRisco,
    nrsAplicaveis: number[],
  ): Promise<ComplianceCheckResult> {
    const pcmsoRequired = grauRisco >= 2;
    const pgrRequired = grauRisco >= 2;

    const result: ComplianceCheckResult = {
      pcmso_required: pcmsoRequired,
      pgr_required: pgrRequired,
      pcmso_exists: false,
      pgr_exists: false,
      violations_created: [],
      pcmso_reminders_created: 0,
    };

    if (!pcmsoRequired && !pgrRequired) return result;

    // Check existing active programs
    const { data: programs } = await supabase
      .from('health_programs')
      .select('id, program_type, status')
      .eq('tenant_id', tenantId)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .is('deleted_at', null);

    const activePrograms = programs ?? [];
    result.pcmso_exists = activePrograms.some(p => p.program_type === 'pcmso');
    result.pgr_exists = activePrograms.some(p => p.program_type === 'pgr');

    // Create violations for missing mandatory programs
    if (pcmsoRequired && !result.pcmso_exists) {
      await this._createViolation(tenantId, companyId, {
        violation_type: 'missing_pcmso',
        severity: 'critical',
        description: `Empresa com grau de risco ${grauRisco} não possui PCMSO ativo. O programa é obrigatório conforme NR-7 para empresas com grau de risco ≥ 2.`,
      });
      result.violations_created.push('missing_pcmso');
    }

    if (pgrRequired && !result.pgr_exists) {
      await this._createViolation(tenantId, companyId, {
        violation_type: 'missing_pgr',
        severity: 'critical',
        description: `Empresa com grau de risco ${grauRisco} não possui PGR/PPRA ativo. O programa é obrigatório conforme NR-1 para empresas com grau de risco ≥ 2.`,
      });
      result.violations_created.push('missing_pgr');
    }

    // Create PCMSO exam reminders if NRs require medical exams
    const nrsRequiringExams = nrsAplicaveis.filter(nr => NRS_REQUIRING_MEDICAL_EXAM.includes(nr));

    if (nrsRequiringExams.length > 0) {
      const reminders = await this._createPcmsoReminders(tenantId, companyId, nrsRequiringExams);
      result.pcmso_reminders_created = reminders;
    }

    return result;
  },

  /**
   * Create a compliance violation for a company (no employee-specific).
   * Uses a placeholder employee_id pattern for company-level violations.
   */
  async _createViolation(
    tenantId: string,
    companyId: string,
    violation: {
      violation_type: string;
      severity: string;
      description: string;
    },
  ): Promise<void> {
    // Check if same violation already exists (avoid duplicates)
    const { data: existing } = await supabase
      .from('compliance_violations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('company_id', companyId)
      .eq('violation_type', violation.violation_type)
      .eq('is_resolved', false)
      .limit(1);

    if (existing && existing.length > 0) return;

    // compliance_violations requires employee_id; use a sentinel approach:
    // get any employee from the company or skip if none
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .limit(1);

    if (!employees || employees.length === 0) {
      console.warn(`[LaborComplianceIntegration] No employees in company ${companyId}, skipping violation ${violation.violation_type}`);
      return;
    }

    await supabase.from('compliance_violations').insert({
      tenant_id: tenantId,
      company_id: companyId,
      employee_id: employees[0].id,
      violation_type: violation.violation_type,
      severity: violation.severity,
      description: violation.description,
      metadata: { source: 'occupational_intelligence', auto_generated: true } as any,
    });
  },

  /**
   * Create PCMSO reminders as compliance violations for NRs requiring medical exams.
   */
  async _createPcmsoReminders(
    tenantId: string,
    companyId: string,
    nrsRequiringExams: number[],
  ): Promise<number> {
    const NR_EXAM_DESCRIPTIONS: Record<number, string> = {
      7: 'NR-7 (PCMSO) exige exames admissional, periódico, de retorno, de mudança de função e demissional.',
      9: 'NR-9 exige monitoramento de saúde para exposição a agentes ocupacionais.',
      10: 'NR-10 exige aptidão médica para trabalho com eletricidade.',
      15: 'NR-15 exige acompanhamento médico para atividades insalubres.',
      16: 'NR-16 exige acompanhamento médico para atividades perigosas.',
      32: 'NR-32 exige vacinação e acompanhamento para profissionais de saúde.',
      33: 'NR-33 exige aptidão médica para trabalho em espaços confinados.',
      35: 'NR-35 exige aptidão médica para trabalho em altura.',
    };

    let created = 0;

    for (const nr of nrsRequiringExams) {
      const desc = NR_EXAM_DESCRIPTIONS[nr] ?? `NR-${nr} exige exame médico ocupacional.`;

      // Check for existing reminder
      const { data: existing } = await supabase
        .from('compliance_violations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('company_id', companyId)
        .eq('violation_type', `pcmso_reminder_nr${nr}`)
        .eq('is_resolved', false)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .limit(1);

      if (!employees || employees.length === 0) continue;

      await supabase.from('compliance_violations').insert({
        tenant_id: tenantId,
        company_id: companyId,
        employee_id: employees[0].id,
        violation_type: `pcmso_reminder_nr${nr}`,
        severity: 'warning',
        description: `Lembrete PCMSO: ${desc} Verifique se todos os colaboradores possuem ASO em dia.`,
        metadata: { source: 'occupational_intelligence', nr_codigo: nr, auto_generated: true } as any,
      });
      created++;
    }

    return created;
  },

  /**
   * Wire up the event listener so this runs automatically
   * when a CompanyRiskProfileGenerated event is emitted.
   */
  init() {
    return occupationalEvents.subscribe((event) => {
      if (event.type === 'CompanyRiskProfileGenerated') {
        const p = event.payload;
        this.enforceForCompany(
          p.tenant_id,
          p.company_id,
          p.grau_risco as GrauRisco,
          p.nrs_aplicaveis,
        ).catch(err => {
          console.error('[LaborComplianceIntegration] Failed to enforce compliance:', err);
        });
      }
    });
  },
};
