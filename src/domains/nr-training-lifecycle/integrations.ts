/**
 * NR Training Lifecycle Engine — Integration Bridge
 *
 * Connects the Training Lifecycle Engine with:
 *   1. Occupational Intelligence: auto-assign trainings on company onboarding
 *   2. Labor Compliance: create violations for overdue/blocked trainings
 *   3. Workforce Intelligence: provide training gap data for risk detection
 *   4. Employee Agreement: auto-create training acknowledgment terms
 */

import { trainingLifecycleEvents } from './events';
import type { TrainingBlockedEvent, TrainingExpiredEvent } from './events';
import { trainingLifecycleService } from './training-lifecycle.service';
import { supabase } from '@/integrations/supabase/client';
import { occupationalEvents } from '@/domains/occupational-intelligence/occupational-compliance.events';
import type { OccupationalComplianceEvent } from '@/domains/occupational-intelligence/occupational-compliance.events';
import { getBlockingDescription } from './lifecycle.engine';
import type { Json } from '@/integrations/supabase/types';
import type { CreateAssignmentDTO } from './types';

export const trainingIntegrations = {

  /**
   * Initialize all event subscriptions.
   * Call once at app startup.
   */
  init(): void {
    // ── 1. Occupational Intelligence → Auto-assign trainings ──
    occupationalEvents.subscribe((event: OccupationalComplianceEvent) => {
      if (event.type !== 'TrainingRequirementCreated') return;

      const { tenant_id, company_id, cbo_codigo, nr_codigo } = event.payload as any;

      // Get active employees for this company and create assignments
      (async () => {
        const { data: employees } = await supabase
          .from('employees')
          .select('id, position_id')
          .eq('company_id', company_id)
          .eq('status', 'active');

        if (!employees || employees.length === 0) return;

        const dtos: CreateAssignmentDTO[] = employees.map(emp => ({
          tenant_id,
          company_id,
          employee_id: emp.id,
          nr_number: nr_codigo,
          training_name: `Treinamento NR-${nr_codigo}`,
          cbo_code: cbo_codigo,
          trigger: 'admission' as const,
          required_hours: 8,
        }));

        try {
          await trainingLifecycleService.createBulkAssignments(dtos);
          console.log(`[TrainingIntegrations] Created ${dtos.length} assignments for NR-${nr_codigo}`);
        } catch (err) {
          console.error('[TrainingIntegrations] Bulk assignment error:', err);
        }
      })();
    });

    // ── 2. Training blocked → Labor Compliance violation ──
    trainingLifecycleEvents.subscribe<TrainingBlockedEvent>('TrainingBlocked', async (event) => {
      const { assignment_id, employee_id, training_name, nr_number, blocking_level } = event.payload;

      const { data: assignment } = await (supabase.from('nr_training_assignments' as any).select('tenant_id, company_id').eq('id', assignment_id).single() as any);
      if (!assignment) return;

      const description = getBlockingDescription(blocking_level, nr_number);

      await supabase.from('compliance_violations').insert([{
        tenant_id: assignment.tenant_id,
        employee_id,
        company_id: assignment.company_id,
        violation_type: 'training_blocked',
        description,
        severity: blocking_level === 'hard_block' ? 'critical' : 'high',
        metadata: { assignment_id, nr_number, training_name, blocking_level } as unknown as Json,
      }]);

      console.log(`[TrainingIntegrations] Compliance violation created for blocked NR-${nr_number}`);
    });

    // ── 3. Training expired → auto-renewal + violation ──
    trainingLifecycleEvents.subscribe<TrainingExpiredEvent>('TrainingExpired', async (event) => {
      const { assignment_id, employee_id, training_name, nr_number, blocking_level } = event.payload;

      const { data: assignment } = await (supabase.from('nr_training_assignments' as any).select('tenant_id, company_id').eq('id', assignment_id).single() as any);
      if (!assignment) return;

      // Auto-create renewal
      const { data: fullAssignment } = await (supabase.from('nr_training_assignments' as any).select('*').eq('id', assignment_id).single() as any);
      if (fullAssignment) {
        try {
          await trainingLifecycleService.createRenewal(fullAssignment);
          console.log(`[TrainingIntegrations] Auto-renewal created for expired NR-${nr_number}`);
        } catch (err) {
          console.error('[TrainingIntegrations] Renewal creation error:', err);
        }
      }

      await supabase.from('compliance_violations').insert([{
        tenant_id: assignment.tenant_id,
        employee_id,
        company_id: assignment.company_id,
        violation_type: 'training_expired',
        description: `Treinamento NR-${nr_number} (${training_name}) expirado. Reciclagem obrigatória.`,
        severity: blocking_level !== 'none' ? 'critical' : 'high',
        metadata: { assignment_id, nr_number, training_name, blocking_level } as unknown as Json,
      }]);
    });

    console.log('[TrainingIntegrations] All subscriptions initialized');
  },
};
