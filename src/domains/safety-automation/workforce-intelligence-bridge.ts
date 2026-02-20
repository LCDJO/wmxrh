/**
 * Safety Automation Engine — Workforce Intelligence Integration
 *
 * Bridges safety automation events into Workforce Intelligence insights:
 *
 *   SafetyAutomationTriggered  — automation was triggered for an employee
 *   WorkflowOverdue            — safety workflow/task exceeded its deadline
 *   RiskMitigationInProgress   — corrective actions are actively being executed
 *
 * Subscribes to the Safety Event Bus and produces structured insight records.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  onSafetyEvent,
  type SafetyAutomationEvent,
} from './events';

// ═══════════════════════════════════════════════════════
// INSIGHT TYPES
// ═══════════════════════════════════════════════════════

export type SafetyInsightType =
  | 'SafetyAutomationTriggered'
  | 'WorkflowOverdue'
  | 'RiskMitigationInProgress';

export interface SafetyInsight {
  tenant_id: string;
  insight_type: SafetyInsightType;
  entity_type: 'employee' | 'company' | 'department' | 'tenant';
  entity_id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// INSIGHT EMITTER
// ═══════════════════════════════════════════════════════

async function persistInsight(insight: SafetyInsight): Promise<void> {
  // Store as audit_log entry with safety_insight action for now
  // This integrates with existing audit infrastructure
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      tenant_id: insight.tenant_id,
      action: `safety_insight:${insight.insight_type}`,
      entity_type: insight.entity_type,
      entity_id: insight.entity_id,
      metadata: {
        insight_type: insight.insight_type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        ...insight.metadata,
      },
    });

  if (error) {
    console.warn('[WorkforceIntelligence] Failed to persist insight:', error.message);
  }
}

// ═══════════════════════════════════════════════════════
// EVENT HANDLERS → INSIGHTS
// ═══════════════════════════════════════════════════════

function handleSafetyAutomationTriggered(event: SafetyAutomationEvent): SafetyInsight | null {
  if (event.type === 'SafetySignalReceived') {
    return {
      tenant_id: event.tenant_id,
      insight_type: 'SafetyAutomationTriggered',
      entity_type: event.entity_type as SafetyInsight['entity_type'],
      entity_id: event.entity_id,
      severity: event.severity === 'critical' || event.severity === 'high' ? 'critical' : 'warning',
      title: 'Automação de segurança acionada',
      description: `Sinal de segurança "${event.source}" (${event.severity}) detectado e processado automaticamente.`,
      metadata: {
        signal_id: event.signal_id,
        source: event.source,
        signal_severity: event.severity,
      },
      created_at: new Date(event.timestamp).toISOString(),
    };
  }
  return null;
}

function handleRiskMitigationInProgress(event: SafetyAutomationEvent): SafetyInsight | null {
  if (event.type === 'SafetyExecutionCompleted') {
    return {
      tenant_id: event.tenant_id,
      insight_type: 'RiskMitigationInProgress',
      entity_type: 'tenant',
      entity_id: event.tenant_id,
      severity: event.actions_failed > 0 ? 'warning' : 'info',
      title: 'Mitigação de risco em andamento',
      description: `Execução concluída: ${event.actions_succeeded}/${event.actions_total} ações bem-sucedidas (${event.duration_ms}ms).`,
      metadata: {
        execution_id: event.execution_id,
        signal_id: event.signal_id,
        rule_id: event.rule_id,
        status: event.status,
        actions_total: event.actions_total,
        actions_succeeded: event.actions_succeeded,
        actions_failed: event.actions_failed,
        duration_ms: event.duration_ms,
      },
      created_at: new Date(event.timestamp).toISOString(),
    };
  }
  return null;
}

function handleEscalationInsight(event: SafetyAutomationEvent): SafetyInsight | null {
  if (event.type === 'SafetyEscalationTriggered') {
    return {
      tenant_id: event.tenant_id,
      insight_type: 'WorkflowOverdue',
      entity_type: 'tenant',
      entity_id: event.tenant_id,
      severity: event.escalation_level >= 2 ? 'critical' : 'warning',
      title: `Escalação nível ${event.escalation_level}`,
      description: event.reason,
      metadata: {
        signal_id: event.signal_id,
        escalation_level: event.escalation_level,
      },
      created_at: new Date(event.timestamp).toISOString(),
    };
  }
  return null;
}

function handleBlockInsight(event: SafetyAutomationEvent): SafetyInsight | null {
  if (event.type === 'SafetyEmployeeBlocked') {
    return {
      tenant_id: event.tenant_id,
      insight_type: 'RiskMitigationInProgress',
      entity_type: 'employee',
      entity_id: event.employee_id,
      severity: 'critical',
      title: 'Colaborador bloqueado por segurança',
      description: `Bloqueio ${event.blocking_level}: ${event.reason}`,
      metadata: {
        signal_id: event.signal_id,
        blocking_level: event.blocking_level,
      },
      created_at: new Date(event.timestamp).toISOString(),
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// OVERDUE SCANNER
// ═══════════════════════════════════════════════════════

/**
 * Scan for overdue safety workflows/tasks and generate WorkflowOverdue insights.
 */
export async function scanOverdueWorkflows(tenantId: string): Promise<SafetyInsight[]> {
  const { data: overdueTasks } = await supabase
    .from('safety_tasks')
    .select('id, employee_id, descricao, prazo, priority, escalation_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lt('prazo', new Date().toISOString());

  if (!overdueTasks?.length) return [];

  const insights: SafetyInsight[] = overdueTasks.map((task: any) => ({
    tenant_id: tenantId,
    insight_type: 'WorkflowOverdue' as SafetyInsightType,
    entity_type: task.employee_id ? 'employee' as const : 'tenant' as const,
    entity_id: task.employee_id ?? tenantId,
    severity: (task.priority === 'critical' || task.escalation_count > 1 ? 'critical' : 'warning') as SafetyInsight['severity'],
    title: 'Tarefa de segurança vencida',
    description: `Tarefa "${task.descricao?.substring(0, 80)}" ultrapassou prazo (prioridade: ${task.priority}).`,
    metadata: {
      task_id: task.id,
      prazo: task.prazo,
      priority: task.priority,
      escalation_count: task.escalation_count,
    },
    created_at: new Date().toISOString(),
  }));

  // Persist all overdue insights
  for (const insight of insights) {
    await persistInsight(insight);
  }

  return insights;
}

// ═══════════════════════════════════════════════════════
// SUBSCRIBER — Wire into Safety Event Bus
// ═══════════════════════════════════════════════════════

let unsubscribe: (() => void) | null = null;

/**
 * Start listening to safety events and generating workforce insights.
 */
export function startWorkforceIntelligenceBridge(): () => void {
  if (unsubscribe) return unsubscribe;

  unsubscribe = onSafetyEvent(async (event) => {
    const generators = [
      handleSafetyAutomationTriggered,
      handleRiskMitigationInProgress,
      handleEscalationInsight,
      handleBlockInsight,
    ];

    for (const gen of generators) {
      const insight = gen(event);
      if (insight) {
        await persistInsight(insight);
      }
    }
  });

  return unsubscribe;
}

/**
 * Get recent safety insights for a tenant.
 */
export async function getRecentSafetyInsights(
  tenantId: string,
  limit = 20,
): Promise<SafetyInsight[]> {
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .like('action', 'safety_insight:%')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => ({
    tenant_id: row.tenant_id,
    insight_type: row.metadata?.insight_type ?? 'SafetyAutomationTriggered',
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    severity: row.metadata?.severity ?? 'info',
    title: row.metadata?.title ?? '',
    description: row.metadata?.description ?? '',
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  }));
}
