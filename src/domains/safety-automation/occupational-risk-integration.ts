/**
 * Safety Automation Engine — Occupational Risk Integration
 *
 * After safety tasks are completed:
 *   1. Recalculate score_risco_operacional for the employee
 *   2. Remove operational blocks if all blocking tasks are resolved
 *
 * Listens to task completion events and updates risk state accordingly.
 */

import { supabase } from '@/integrations/supabase/client';
import { emitSafetyEvent } from './events';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface RiskScoreFactors {
  pending_tasks: number;
  overdue_tasks: number;
  escalated_tasks: number;
  active_blocks: number;
  expired_trainings: number;
  overdue_exams: number;
  missing_epis: number;
}

export interface RiskRecalculationResult {
  employee_id: string;
  previous_score: number | null;
  new_score: number;
  factors: RiskScoreFactors;
  blocks_removed: number;
}

// ═══════════════════════════════════════════════════════
// SCORE CALCULATION
// ═══════════════════════════════════════════════════════

/**
 * Calculate operational risk score (0–100, lower is better).
 * Weights: overdue tasks (30), escalated (20), blocks (25), trainings (15), exams (10).
 */
function calculateRiskScore(factors: RiskScoreFactors): number {
  const score =
    Math.min(factors.overdue_tasks * 10, 30) +
    Math.min(factors.escalated_tasks * 10, 20) +
    Math.min(factors.active_blocks * 25, 25) +
    Math.min(factors.expired_trainings * 5, 15) +
    Math.min(factors.overdue_exams * 10, 10) +
    Math.min(factors.missing_epis * 15, 30);  // EPI compliance: +15/missing, max 30

  return Math.min(100, Math.max(0, score));
}

// ═══════════════════════════════════════════════════════
// GATHER RISK FACTORS
// ═══════════════════════════════════════════════════════

async function gatherRiskFactors(tenantId: string, employeeId: string): Promise<RiskScoreFactors> {
  const now = new Date().toISOString();

  // Parallel queries for all risk factors
  const [pendingRes, overdueRes, escalatedRes, blocksRes, trainingsRes, examsRes, missingEpisRes] =
    await Promise.all([
      // Pending tasks
      supabase
        .from('safety_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'pending'),

      // Overdue tasks
      supabase
        .from('safety_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'pending')
        .lt('prazo', now),

      // Escalated tasks
      supabase
        .from('safety_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'pending')
        .gt('escalation_count' as any, 0),

      // Active blocks
      supabase
        .from('safety_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'pending')
        .contains('metadata' as any, { action_type: 'block_employee' }),

      // Expired trainings
      supabase
        .from('employee_training_assignments' as any)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'expired'),

      // Overdue exams
      supabase
        .from('employee_health_exams')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('is_valid', true)
        .lt('next_exam_date', now.split('T')[0]),

      // Missing EPIs (exposed to risk, no active EPI delivered)
      supabase
        .from('epi_requirements' as any)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('status', 'pendente')
        .eq('obrigatorio', true),
    ]);

  return {
    pending_tasks: pendingRes.count ?? 0,
    overdue_tasks: overdueRes.count ?? 0,
    escalated_tasks: escalatedRes.count ?? 0,
    active_blocks: blocksRes.count ?? 0,
    expired_trainings: trainingsRes.count ?? 0,
    overdue_exams: examsRes.count ?? 0,
    missing_epis: missingEpisRes.count ?? 0,
  };
}

// ═══════════════════════════════════════════════════════
// RECALCULATE & UNBLOCK
// ═══════════════════════════════════════════════════════

/**
 * Recalculate operational risk score for an employee after task completion.
 */
export async function recalculateEmployeeRiskScore(
  tenantId: string,
  employeeId: string,
): Promise<RiskRecalculationResult> {
  const factors = await gatherRiskFactors(tenantId, employeeId);
  const newScore = calculateRiskScore(factors);

  // Get previous score from employee_risk_exposures
  const { data: currentExposure } = await supabase
    .from('employee_risk_exposures')
    .select('risk_score')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousScore = (currentExposure as any)?.risk_score ?? null;

  // Persist new score to the latest active exposure
  if (currentExposure) {
    await supabase
      .from('employee_risk_exposures')
      .update({ risk_score: newScore } as any)
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
  }

  // Log the recalculation as audit entry
  await supabase.from('audit_logs').insert([{
    tenant_id: tenantId,
    action: 'risk_score_recalculated',
    entity_type: 'employee',
    entity_id: employeeId,
    old_value: previousScore != null ? { score: previousScore } as any : null,
    new_value: { score: newScore, factors } as any,
  }]);

  // Generate critical alert if employee has missing EPIs while exposed to risk
  if (factors.missing_epis > 0) {
    try {
      // Emit specific EPI block event
      emitSafetyEvent({
        type: 'EmployeeOperationBlockedByEPI',
        timestamp: Date.now(),
        tenant_id: tenantId,
        employee_id: employeeId,
        missing_mandatory_epis: factors.missing_epis,
        reason: `Colaborador exposto a risco com ${factors.missing_epis} EPI(s) obrigatório(s) pendente(s)`,
      });

      emitSafetyEvent({
        type: 'SafetyExecutionCompleted',
        timestamp: Date.now(),
        tenant_id: tenantId,
        execution_id: `epi-compliance-alert-${employeeId}`,
        signal_id: '',
        rule_id: '',
        status: 'completed',
        actions_total: 1,
        actions_succeeded: 1,
        actions_failed: 0,
        duration_ms: 0,
      });

      await supabase.from('audit_logs').insert([{
        tenant_id: tenantId,
        action: 'epi_compliance_critical_alert',
        entity_type: 'employee',
        entity_id: employeeId,
        new_value: {
          missing_epis: factors.missing_epis,
          risk_score: newScore,
          alert: 'Colaborador exposto a risco sem EPI ativo obrigatório',
        } as any,
      }]);

      console.warn(
        `[OccupationalRisk] CRITICAL: Employee ${employeeId} exposed to risk with ${factors.missing_epis} missing EPI(s). Score: ${newScore}`,
      );
    } catch (err) {
      console.error('[OccupationalRisk] Failed to emit EPI compliance alert:', err);
    }
  }

  // Remove blocks if no blocking factors remain
  let blocksRemoved = 0;
  if (factors.active_blocks === 0 && factors.overdue_tasks === 0 && factors.escalated_tasks === 0) {
    blocksRemoved = await removeOperationalBlocks(tenantId, employeeId);
  }

  return {
    employee_id: employeeId,
    previous_score: previousScore,
    new_score: newScore,
    factors,
    blocks_removed: blocksRemoved,
  };
}

/**
 * Remove operational block tasks that are no longer needed.
 */
async function removeOperationalBlocks(tenantId: string, employeeId: string): Promise<number> {
  // Find pending block tasks for this employee
  const { data: blockTasks } = await supabase
    .from('safety_tasks')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
    .contains('metadata' as any, { action_type: 'block_employee' });

  if (!blockTasks?.length) return 0;

  // Mark block tasks as done (unblock)
  const ids = blockTasks.map((t: any) => t.id);
  const { error } = await supabase
    .from('safety_tasks')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      metadata: {
        action_type: 'block_employee',
        auto_resolved: true,
        resolved_reason: 'all_blocking_factors_cleared',
      },
    } as any)
    .in('id', ids);

  if (error) {
    console.error('[OccupationalRisk] Failed to remove blocks:', error);
    return 0;
  }

  return ids.length;
}

// ═══════════════════════════════════════════════════════
// TASK COMPLETION HANDLER
// ═══════════════════════════════════════════════════════

/**
 * Called when a safety task is completed. Triggers risk recalculation
 * and potential block removal for the associated employee.
 */
export async function onSafetyTaskCompleted(
  tenantId: string,
  taskId: string,
): Promise<RiskRecalculationResult | null> {
  // Fetch the completed task
  const { data: task } = await supabase
    .from('safety_tasks')
    .select('employee_id, workflow_id, metadata')
    .eq('id', taskId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employeeId = (task as any)?.employee_id;
  if (!employeeId) return null;

  const result = await recalculateEmployeeRiskScore(tenantId, employeeId);

  // Emit event for Workforce Intelligence
  emitSafetyEvent({
    type: 'SafetyExecutionCompleted',
    timestamp: Date.now(),
    tenant_id: tenantId,
    execution_id: taskId,
    signal_id: '',
    rule_id: '',
    status: 'completed',
    actions_total: 1,
    actions_succeeded: 1,
    actions_failed: 0,
    duration_ms: 0,
  });

  console.log(
    `[OccupationalRisk] Employee ${employeeId}: score ${result.previous_score ?? '?'} → ${result.new_score}, blocks removed: ${result.blocks_removed}`,
  );

  return result;
}

/**
 * Batch recalculate risk scores for all employees with pending tasks in a tenant.
 */
export async function batchRecalculateRiskScores(
  tenantId: string,
): Promise<RiskRecalculationResult[]> {
  // Get distinct employee IDs with pending safety tasks
  const { data: tasks } = await supabase
    .from('safety_tasks')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .not('employee_id', 'is', null);

  const employeeIds = [...new Set((tasks ?? []).map((t: any) => t.employee_id).filter(Boolean))];

  const results: RiskRecalculationResult[] = [];
  for (const empId of employeeIds) {
    const result = await recalculateEmployeeRiskScore(tenantId, empId);
    results.push(result);
  }

  return results;
}
