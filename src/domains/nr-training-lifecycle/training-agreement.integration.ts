/**
 * NR Training ↔ Employee Agreement Integration
 *
 * Automatically generates and dispatches agreement terms
 * when NR trainings require employee acknowledgment signatures.
 *
 * Rules:
 *   - NR-06  → Termo de Uso de EPI
 *   - NR-10  → Termo de Ciência de Risco Elétrico
 *   - NR-33  → Termo de Ciência de Espaço Confinado
 *   - NR-35  → Termo de Ciência de Trabalho em Altura
 *   - NR-12  → Termo de Ciência de Máquinas e Equipamentos
 *   - NR-18  → Termo de Ciência de Condições de Trabalho na Construção
 *
 * Listens to: TrainingAssigned, TrainingCompleted
 * Emits to:   agreement.sent_for_signature (via Employee Agreement Engine)
 */

import { supabase } from '@/integrations/supabase/client';
import { trainingLifecycleEvents } from './events';
import type { TrainingAssignedEvent, TrainingCompletedEvent } from './events';
import { emitAgreementEvent } from '@/domains/employee-agreement/events';

// ═══════════════════════════════════════════════════════
// NR → AGREEMENT TEMPLATE MAPPING
// ═══════════════════════════════════════════════════════

export interface NrAgreementRule {
  nr_number: number;
  template_slug: string;
  term_name: string;
  description: string;
  /** When to generate: 'on_assignment' or 'on_completion' */
  trigger_phase: 'on_assignment' | 'on_completion';
  /** Is signature mandatory before starting activity? */
  mandatory_before_activity: boolean;
}

const NR_AGREEMENT_RULES: NrAgreementRule[] = [
  {
    nr_number: 6,
    template_slug: 'termo-uso-epi',
    term_name: 'Termo de Responsabilidade de Uso de EPI',
    description: 'Declaração de recebimento e compromisso de uso dos Equipamentos de Proteção Individual conforme NR-06.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: true,
  },
  {
    nr_number: 10,
    template_slug: 'termo-risco-eletrico',
    term_name: 'Termo de Ciência de Risco Elétrico',
    description: 'Reconhecimento dos riscos envolvidos em atividades com eletricidade conforme NR-10.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: true,
  },
  {
    nr_number: 12,
    template_slug: 'termo-maquinas-equipamentos',
    term_name: 'Termo de Ciência sobre Máquinas e Equipamentos',
    description: 'Reconhecimento dos riscos e procedimentos de segurança com máquinas conforme NR-12.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: false,
  },
  {
    nr_number: 18,
    template_slug: 'termo-construcao-civil',
    term_name: 'Termo de Ciência de Condições de Trabalho na Construção',
    description: 'Reconhecimento das condições e riscos no ambiente de construção civil conforme NR-18.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: false,
  },
  {
    nr_number: 33,
    template_slug: 'termo-espaco-confinado',
    term_name: 'Termo de Ciência de Espaço Confinado',
    description: 'Reconhecimento dos riscos e procedimentos para trabalho em espaço confinado conforme NR-33.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: true,
  },
  {
    nr_number: 35,
    template_slug: 'termo-trabalho-altura',
    term_name: 'Termo de Ciência de Trabalho em Altura',
    description: 'Reconhecimento dos riscos e procedimentos para trabalho em altura conforme NR-35.',
    trigger_phase: 'on_assignment',
    mandatory_before_activity: true,
  },
];

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export function getNrAgreementRules(): NrAgreementRule[] {
  return [...NR_AGREEMENT_RULES];
}

export function getRuleForNr(nrNumber: number): NrAgreementRule | undefined {
  return NR_AGREEMENT_RULES.find(r => r.nr_number === nrNumber);
}

export function nrRequiresAgreement(nrNumber: number): boolean {
  return NR_AGREEMENT_RULES.some(r => r.nr_number === nrNumber);
}

// ═══════════════════════════════════════════════════════
// AUTO-DISPATCH LOGIC
// ═══════════════════════════════════════════════════════

/**
 * Given a training assignment, find or create the matching agreement template
 * and send it to the employee for signature.
 */
async function dispatchAgreementForTraining(
  tenantId: string,
  employeeId: string,
  companyId: string | null,
  nrNumber: number,
  assignmentId: string,
): Promise<{ dispatched: boolean; agreement_id?: string; reason?: string }> {
  const rule = getRuleForNr(nrNumber);
  if (!rule) return { dispatched: false, reason: `NR-${nrNumber} does not require agreement` };

  // 1. Find existing template by slug
  const { data: template } = await supabase
    .from('agreement_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', rule.template_slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!template) {
    return {
      dispatched: false,
      reason: `Template '${rule.template_slug}' not found for tenant. Create it first.`,
    };
  }

  // 2. Check if agreement already exists for this employee + template (avoid duplicates)
  const { data: existing } = await supabase
    .from('employee_agreements')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('template_id', template.id)
    .in('status', ['pending', 'sent'])
    .maybeSingle();

  if (existing) {
    return { dispatched: false, reason: `Agreement already pending (${existing.id})` };
  }

  // 3. Get current template version
  const { data: version } = await supabase
    .from('agreement_template_versions')
    .select('id')
    .eq('template_id', template.id)
    .eq('is_current', true)
    .maybeSingle();

  if (!version) {
    return { dispatched: false, reason: `No active version for template '${rule.template_slug}'` };
  }

  // 4. Create employee agreement record
  const { data: agreement, error } = await supabase
    .from('employee_agreements')
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      template_id: template.id,
      template_version_id: version.id,
      company_id: companyId,
      status: 'pending',
      signature_provider: 'simulation',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[TrainingAgreement] Failed to create agreement:', error);
    return { dispatched: false, reason: error.message };
  }

  // 5. Link agreement to training assignment
  await supabase
    .from('nr_training_assignments')
    .update({ agreement_id: agreement.id })
    .eq('id', assignmentId);

  // 6. Emit event
  emitAgreementEvent({
    type: 'agreement.sent_for_signature',
    tenant_id: tenantId,
    employee_id: employeeId,
    agreement_id: agreement.id,
    template_id: template.id,
    payload: {
      trigger: 'nr_training',
      nr_number: nrNumber,
      assignment_id: assignmentId,
      term_name: rule.term_name,
      mandatory_before_activity: rule.mandatory_before_activity,
    },
    timestamp: new Date().toISOString(),
  });

  console.log(`[TrainingAgreement] Dispatched '${rule.term_name}' for employee ${employeeId}`);
  return { dispatched: true, agreement_id: agreement.id };
}

// ═══════════════════════════════════════════════════════
// EVENT SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════

export function initTrainingAgreementIntegration(): () => void {
  const unsubs: (() => void)[] = [];

  // On TrainingAssigned → dispatch 'on_assignment' agreements
  unsubs.push(
    trainingLifecycleEvents.subscribe<TrainingAssignedEvent>(
      'TrainingAssigned',
      (event) => {
        const { assignment } = event.payload;
        const rule = getRuleForNr(assignment.nr_number);
        if (rule && rule.trigger_phase === 'on_assignment') {
          dispatchAgreementForTraining(
            assignment.tenant_id,
            assignment.employee_id,
            assignment.company_id,
            assignment.nr_number,
            assignment.id,
          ).catch(err =>
            console.error('[TrainingAgreement] on_assignment dispatch error:', err),
          );
        }
      },
    ),
  );

  // On TrainingCompleted → dispatch 'on_completion' agreements
  unsubs.push(
    trainingLifecycleEvents.subscribe<TrainingCompletedEvent>(
      'TrainingCompleted',
      (event) => {
        const { assignment_id, employee_id, completion } = event.payload;
        // Look up the assignment to get nr_number and tenant
        supabase
          .from('nr_training_assignments')
          .select('tenant_id, company_id, nr_number')
          .eq('id', assignment_id)
          .single()
          .then(({ data }) => {
            if (!data) return;
            const rule = getRuleForNr((data as any).nr_number);
            if (rule && rule.trigger_phase === 'on_completion') {
              dispatchAgreementForTraining(
                (data as any).tenant_id,
                employee_id,
                (data as any).company_id,
                (data as any).nr_number,
                assignment_id,
              ).catch(err =>
                console.error('[TrainingAgreement] on_completion dispatch error:', err),
              );
            }
          });
      },
    ),
  );

  return () => unsubs.forEach(fn => fn());
}
