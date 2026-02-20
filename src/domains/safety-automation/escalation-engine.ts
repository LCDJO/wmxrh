/**
 * Safety Automation Engine — Priority & Escalation System
 *
 * Monitors pending safety tasks and escalates when overdue:
 *   Gestor → RH → Admin (next_level)
 *   Priority increases: low → medium → high → critical
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface EscalationPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  dias_sem_resposta: number;
  current_priority: string;
  novo_responsavel: 'next_level' | 'rh_admin' | 'specific_user';
  novo_responsavel_user_id: string | null;
  nova_prioridade: string;
  escalation_level: number;
  max_escalations: number;
  is_active: boolean;
}

export interface EscalationResult {
  task_id: string;
  escalated: boolean;
  new_priority: string | null;
  new_responsavel_id: string | null;
  escalation_level: number;
  reason: string;
}

// Priority ladder
const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'] as const;

function getNextPriority(current: string): string {
  const idx = PRIORITY_ORDER.indexOf(current as any);
  if (idx < 0 || idx >= PRIORITY_ORDER.length - 1) return 'critical';
  return PRIORITY_ORDER[idx + 1];
}

// ═══════════════════════════════════════════════════════
// RESOLVE NEXT-LEVEL RESPONSIBLE
// ═══════════════════════════════════════════════════════

/** Gestor → RH → Admin escalation chain */
async function resolveNextLevelResponsavel(
  tenantId: string,
  currentResponsavelId: string | null,
  employeeId: string | null,
): Promise<string | null> {
  // If no current responsible, assign to RH
  if (!currentResponsavelId) {
    return resolveFirstRHAdmin(tenantId);
  }

  // Check current responsible's role
  const { data: currentRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', currentResponsavelId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const role = (currentRole?.role as string) ?? '';

  // Gestor → RH
  if (role === 'gestor' || role === 'company_admin') {
    return resolveFirstRHAdmin(tenantId);
  }

  // RH → Admin/Owner
  if (role === 'rh') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('role', ['admin', 'owner', 'superadmin', 'tenant_admin'] as any[])
      .limit(1);
    return data?.[0]?.user_id ?? null;
  }

  // Already at top level, try employee's manager chain
  if (employeeId) {
    const { data: emp } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (emp?.manager_id && emp.manager_id !== currentResponsavelId) {
      return emp.manager_id;
    }
  }

  return null;
}

async function resolveFirstRHAdmin(tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['rh', 'admin', 'owner'] as any[])
    .limit(1);
  return data?.[0]?.user_id ?? null;
}

// ═══════════════════════════════════════════════════════
// ESCALATION ENGINE
// ═══════════════════════════════════════════════════════

/**
 * Scan all pending safety tasks for a tenant and escalate overdue ones.
 * Returns list of escalation results.
 */
export async function runEscalationScan(tenantId: string): Promise<EscalationResult[]> {
  // Load active policies ordered by escalation_level
  const { data: policies } = await supabase
    .from('safety_escalation_policies' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('escalation_level', { ascending: true });

  if (!policies?.length) return [];

  // Load pending tasks
  const { data: tasks } = await supabase
    .from('safety_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  if (!tasks?.length) return [];

  const results: EscalationResult[] = [];
  const now = new Date();

  for (const task of tasks) {
    const taskAny = task as any;
    const createdAt = new Date(taskAny.created_at);
    const daysPending = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const currentEscalationCount = taskAny.escalation_count ?? 0;

    // Find matching policy for this task's current state
    const matchingPolicy = (policies as any[]).find(p =>
      daysPending >= p.dias_sem_resposta &&
      currentEscalationCount < p.max_escalations &&
      currentEscalationCount < p.escalation_level,
    );

    if (!matchingPolicy) continue;

    // Resolve new responsible
    let newResponsavelId: string | null = null;

    if (matchingPolicy.novo_responsavel === 'specific_user') {
      newResponsavelId = matchingPolicy.novo_responsavel_user_id;
    } else if (matchingPolicy.novo_responsavel === 'rh_admin') {
      newResponsavelId = await resolveFirstRHAdmin(tenantId);
    } else {
      // next_level
      newResponsavelId = await resolveNextLevelResponsavel(
        tenantId,
        taskAny.responsavel_user_id,
        taskAny.employee_id,
      );
    }

    const newPriority = matchingPolicy.nova_prioridade || getNextPriority(taskAny.priority ?? 'medium');

    // Build escalation history entry
    const historyEntry = {
      escalated_at: now.toISOString(),
      from_responsavel: taskAny.responsavel_user_id,
      to_responsavel: newResponsavelId,
      from_priority: taskAny.priority,
      to_priority: newPriority,
      days_pending: daysPending,
      policy_id: matchingPolicy.id,
    };

    const currentHistory = Array.isArray(taskAny.escalation_history)
      ? taskAny.escalation_history
      : [];

    // Update the task
    await supabase
      .from('safety_tasks')
      .update({
        responsavel_user_id: newResponsavelId ?? taskAny.responsavel_user_id,
        priority: newPriority,
        escalation_count: currentEscalationCount + 1,
        last_escalated_at: now.toISOString(),
        escalation_history: [...currentHistory, historyEntry],
      } as any)
      .eq('id', taskAny.id);

    results.push({
      task_id: taskAny.id,
      escalated: true,
      new_priority: newPriority,
      new_responsavel_id: newResponsavelId,
      escalation_level: currentEscalationCount + 1,
      reason: `${daysPending} dias sem resposta — escalado nível ${currentEscalationCount + 1}`,
    });
  }

  return results;
}

/**
 * Get escalation summary for dashboard.
 */
export async function getEscalationSummary(tenantId: string) {
  const { data: tasks } = await supabase
    .from('safety_tasks')
    .select('priority, escalation_count, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  const pending = tasks ?? [];

  return {
    total_pending: pending.length,
    by_priority: {
      critical: pending.filter(t => (t as any).priority === 'critical').length,
      high: pending.filter(t => (t as any).priority === 'high').length,
      medium: pending.filter(t => (t as any).priority === 'medium').length,
      low: pending.filter(t => (t as any).priority === 'low').length,
    },
    escalated_count: pending.filter(t => ((t as any).escalation_count ?? 0) > 0).length,
    max_escalation_level: Math.max(0, ...pending.map(t => (t as any).escalation_count ?? 0)),
  };
}
