/**
 * NR Training Lifecycle Engine — Integration Bridge
 *
 * Automatic training generator that reacts to domain events:
 *
 * Triggers:
 *   1. TrainingRequirementCreated (from Occupational Intelligence)
 *      → Company onboarding: CNAE resolved → NR requirements generated
 *   2. EmployeeHired (employee_events insert with event_type = 'admission')
 *      → Read CBO → check NR requirements → auto-assign
 *   3. JobPositionChanged (employee_events with event_type = 'position_change')
 *      → Re-evaluate NR requirements for new CBO
 *   4. CompanyRiskProfileGenerated (from Occupational Intelligence)
 *      → Re-evaluate all employees when company risk grade changes
 *
 * Flow:
 *   1) Read CBO do funcionário (from employee → position → cbo_code)
 *   2) Verify mandatory NRs via nr_training_catalog + training_requirements
 *   3) Create EmployeeTraining (nr_training_assignments) automatically
 *   4) Emit TrainingRequirementAssigned event
 *
 * Also handles:
 *   - TrainingBlocked → compliance_violations
 *   - TrainingExpired → auto-renewal + compliance_violations
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

// Helper to bypass strict table typing for new tables
const db = () => supabase as any;

// ═══════════════════════════════════════════════════════
// CORE: Auto-assignment logic
// ═══════════════════════════════════════════════════════

interface EmployeeCboInfo {
  employee_id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  cbo_code: string | null;
}

/**
 * Resolve CBO code for an employee via position lookup.
 */
async function resolveEmployeeCbo(employeeId: string): Promise<EmployeeCboInfo | null> {
  const { data } = await supabase
    .from('employees')
    .select('id, tenant_id, company_id, company_group_id, position_id')
    .eq('id', employeeId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (!data) return null;

  let cboCode: string | null = null;
  if (data.position_id) {
    const { data: position } = await supabase
      .from('positions')
      .select('cbo_code')
      .eq('id', data.position_id)
      .single();
    cboCode = position?.cbo_code ?? null;
  }

  return {
    employee_id: data.id,
    tenant_id: data.tenant_id,
    company_id: data.company_id,
    company_group_id: data.company_group_id ?? null,
    cbo_code: cboCode,
  };
}

/**
 * Get applicable NR catalog items for a company + CBO.
 * Reads from nr_training_catalog filtered by risk grade and CBO.
 */
async function getApplicableCatalogItems(
  tenantId: string,
  companyId: string,
  cboCode: string | null,
): Promise<Array<{ nr_codigo: number; nome: string; carga_horaria_minima: number; validade_meses: number | null; base_legal: string | null }>> {
  // Get company risk grade
  const { data: profile } = await db()
    .from('company_cnae_profiles')
    .select('grau_risco_sugerido')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const grauRisco = profile?.grau_risco_sugerido ?? 1;

  // Get catalog items that apply to this risk grade
  const { data: catalog } = await db()
    .from('nr_training_catalog')
    .select('nr_codigo, nome, carga_horaria_minima, validade_meses, base_legal, target_cbos')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .contains('obrigatoria_para_grau_risco', [grauRisco]);

  if (!catalog || catalog.length === 0) return [];

  // Filter by CBO compatibility
  return catalog.filter((c: { target_cbos?: string[] | null }) => {
    if (!c.target_cbos || c.target_cbos.length === 0) return true; // Universal
    if (!cboCode) return false; // CBO-specific but employee has no CBO
    return c.target_cbos.includes(cboCode);
  });
}

/**
 * Check if employee already has an active/pending assignment for this NR.
 */
async function hasExistingAssignment(employeeId: string, nrCodigo: number): Promise<boolean> {
  const { data } = await db()
    .from('nr_training_assignments')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('nr_number', nrCodigo)
    .in('status', ['pending', 'scheduled', 'in_progress', 'completed'])
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Core generator: reads CBO, checks NRs, creates assignments.
 * Returns the number of new assignments created.
 */
async function generateTrainingsForEmployee(
  employeeId: string,
  trigger: CreateAssignmentDTO['trigger'],
): Promise<number> {
  const info = await resolveEmployeeCbo(employeeId);
  if (!info) return 0;

  const catalog = await getApplicableCatalogItems(info.tenant_id, info.company_id, info.cbo_code);
  if (catalog.length === 0) return 0;

  const dtos: CreateAssignmentDTO[] = [];

  for (const item of catalog) {
    const exists = await hasExistingAssignment(info.employee_id, item.nr_codigo);
    if (exists) continue;

    dtos.push({
      tenant_id: info.tenant_id,
      company_id: info.company_id,
      company_group_id: info.company_group_id,
      employee_id: info.employee_id,
      nr_number: item.nr_codigo,
      training_name: item.nome,
      cbo_code: info.cbo_code,
      trigger,
      required_hours: item.carga_horaria_minima,
      validity_months: item.validade_meses,
      legal_basis: item.base_legal,
    });
  }

  if (dtos.length === 0) return 0;

  const assignments = await trainingLifecycleService.createBulkAssignments(dtos);

  // Emit TrainingRequirementAssigned for each new assignment
  for (const a of assignments) {
    trainingLifecycleEvents.emit({
      type: 'TrainingAssigned',
      payload: { assignment: a, trigger_source: trigger },
    });
  }

  console.log(`[TrainingGenerator] Created ${assignments.length} assignments for employee ${employeeId} (trigger: ${trigger})`);
  return assignments.length;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export const trainingIntegrations = {

  /**
   * Initialize all event subscriptions.
   * Call once at app startup.
   */
  init(): void {

    // ── Trigger 1: TrainingRequirementCreated (Occupational Intelligence) ──
    // When a new NR requirement is created for a company+CBO, assign to all matching employees
    occupationalEvents.subscribe((event: OccupationalComplianceEvent) => {
      if (event.type !== 'TrainingRequirementCreated') return;

      const { tenant_id, company_id, cbo_codigo, nr_codigo } = event.payload as any;

      (async () => {
        try {
          // Get active employees for this company
          const { data: employees } = await supabase
            .from('employees')
            .select('id, position_id')
            .eq('company_id', company_id)
            .eq('status', 'active')
            .is('deleted_at', null);

          if (!employees || employees.length === 0) return;

          // Filter employees by CBO match if specified
          let matchingEmployees = employees;
          if (cbo_codigo) {
            const positionIds = employees.map(e => e.position_id).filter((id): id is string => id != null);
            if (positionIds.length > 0) {
              const { data: positions } = await supabase
                .from('positions')
                .select('id, cbo_code')
                .in('id', positionIds);

              const matchingPositionIds = new Set(
                (positions ?? [])
                  .filter(p => p.cbo_code === cbo_codigo)
                  .map(p => p.id)
              );

              matchingEmployees = employees.filter(e =>
                e.position_id && matchingPositionIds.has(e.position_id)
              );
            }
          }

          // Get catalog info for this NR
          const { data: catalogItem } = await db()
            .from('nr_training_catalog')
            .select('nome, carga_horaria_minima, validade_meses, base_legal')
            .eq('tenant_id', tenant_id)
            .eq('nr_codigo', nr_codigo)
            .eq('is_active', true)
            .limit(1)
            .single();

          const dtos: CreateAssignmentDTO[] = [];
          for (const emp of matchingEmployees) {
            const exists = await hasExistingAssignment(emp.id, nr_codigo);
            if (exists) continue;

            dtos.push({
              tenant_id,
              company_id,
              employee_id: emp.id,
              nr_number: nr_codigo,
              training_name: catalogItem?.nome ?? `Treinamento NR-${nr_codigo}`,
              cbo_code: cbo_codigo ?? null,
              trigger: 'admission',
              required_hours: catalogItem?.carga_horaria_minima ?? 8,
              validity_months: catalogItem?.validade_meses ?? null,
              legal_basis: catalogItem?.base_legal ?? null,
            });
          }

          if (dtos.length > 0) {
            await trainingLifecycleService.createBulkAssignments(dtos);
            console.log(`[TrainingGenerator] Trigger: TrainingRequirementCreated → ${dtos.length} assignments for NR-${nr_codigo}`);
          }
        } catch (err) {
          console.error('[TrainingGenerator] TrainingRequirementCreated error:', err);
        }
      })();
    });

    // ── Trigger 4: CompanyRiskProfileGenerated (Occupational Intelligence) ──
    // When company risk profile changes, re-evaluate all active employees
    occupationalEvents.subscribe((event: OccupationalComplianceEvent) => {
      if (event.type !== 'CompanyRiskProfileGenerated') return;

      const { company_id } = event.payload;

      (async () => {
        try {
          const { data: employees } = await supabase
            .from('employees')
            .select('id')
            .eq('company_id', company_id)
            .eq('status', 'active')
            .is('deleted_at', null);

          if (!employees || employees.length === 0) return;

          let totalCreated = 0;
          for (const emp of employees) {
            totalCreated += await generateTrainingsForEmployee(emp.id, 'cnae_update');
          }

          if (totalCreated > 0) {
            console.log(`[TrainingGenerator] Trigger: CompanyRiskProfileGenerated → ${totalCreated} new assignments`);
          }
        } catch (err) {
          console.error('[TrainingGenerator] CompanyRiskProfileGenerated error:', err);
        }
      })();
    });

    // ── Trigger 2 & 3: EmployeeHired / JobPositionChanged ──
    // Subscribe to realtime employee_events for admission and position_change
    supabase
      .channel('training-generator-employee-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_events',
          filter: 'event_type=in.(admission,position_change,role_change)',
        },
        async (payload) => {
          const record = payload.new as {
            employee_id: string;
            event_type: string;
            tenant_id: string;
          };

          const trigger: CreateAssignmentDTO['trigger'] =
            record.event_type === 'admission' ? 'admission' : 'role_change';

          try {
            const created = await generateTrainingsForEmployee(record.employee_id, trigger);
            if (created > 0) {
              console.log(`[TrainingGenerator] Trigger: ${record.event_type} → ${created} new assignments for employee ${record.employee_id}`);
            }
          } catch (err) {
            console.error(`[TrainingGenerator] ${record.event_type} error:`, err);
          }
        },
      )
      .subscribe();

    // ── Compliance: Training blocked → violation ──
    trainingLifecycleEvents.subscribe<TrainingBlockedEvent>('TrainingBlocked', async (event) => {
      const { assignment_id, employee_id, training_name, nr_number, blocking_level } = event.payload;

      const { data: assignment } = await db().from('nr_training_assignments').select('tenant_id, company_id').eq('id', assignment_id).single();
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

      console.log(`[TrainingGenerator] Compliance violation: blocked NR-${nr_number}`);
    });

    // ── Compliance: Training expired → auto-renewal + violation ──
    trainingLifecycleEvents.subscribe<TrainingExpiredEvent>('TrainingExpired', async (event) => {
      const { assignment_id, employee_id, training_name, nr_number, blocking_level } = event.payload;

      const { data: assignment } = await db().from('nr_training_assignments').select('*').eq('id', assignment_id).single();
      if (!assignment) return;

      // Auto-create renewal assignment
      try {
        await trainingLifecycleService.createRenewal(assignment);
        console.log(`[TrainingGenerator] Auto-renewal created for expired NR-${nr_number}`);
      } catch (err) {
        console.error('[TrainingGenerator] Renewal creation error:', err);
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

    console.log('[TrainingGenerator] All subscriptions initialized (TrainingRequirementCreated, CompanyRiskProfileGenerated, EmployeeHired, JobPositionChanged, TrainingBlocked, TrainingExpired)');
  },

  /**
   * Manually trigger training generation for a specific employee.
   * Useful for on-demand re-evaluation.
   */
  generateForEmployee: generateTrainingsForEmployee,
};
