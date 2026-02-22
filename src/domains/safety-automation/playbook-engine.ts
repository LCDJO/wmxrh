/**
 * Safety Automation Engine — Safety Playbooks
 *
 * Pre-defined automation rule templates that map safety events
 * to ordered action chains:
 *
 *   evento_origem → condição → ações[]
 *
 * Examples:
 *   NR-35 vencida → criar tarefa + bloquear operação + gerar termo
 *   Exame periódico vencido → agendar exame + notificar RH
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  SafetySignal,
  SafetyAction,
  SafetyRuleCondition,
  SafetyActionExecutorPort,
  ActionContext,
} from './types';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface SafetyPlaybook {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  evento_origem: string;
  condicao: SafetyRuleCondition[];
  min_severity: string;
  acoes: SafetyAction[];
  is_system: boolean;
  is_active: boolean;
  priority: number;
  cooldown_hours: number;
  trigger_count: number;
  last_triggered_at: string | null;
}

export interface PlaybookMatchResult {
  playbook: SafetyPlaybook;
  matched: boolean;
  reason: string;
}

// Severity ordering
const SEVERITY_ORDER: Record<string, number> = {
  informational: 0, low: 1, medium: 2, high: 3, critical: 4,
};

// ═══════════════════════════════════════════════════════
// CONDITION EVALUATOR
// ═══════════════════════════════════════════════════════

function resolveField(signal: SafetySignal, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = signal;
  for (const part of parts) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(signal: SafetySignal, condition: SafetyRuleCondition): boolean {
  const actual = resolveField(signal, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':       return actual === expected;
    case 'neq':      return actual !== expected;
    case 'gt':       return typeof actual === 'number' && actual > (expected as number);
    case 'gte':      return typeof actual === 'number' && actual >= (expected as number);
    case 'lt':       return typeof actual === 'number' && actual < (expected as number);
    case 'lte':      return typeof actual === 'number' && actual <= (expected as number);
    case 'in':       return Array.isArray(expected) && expected.includes(actual);
    case 'contains': return typeof actual === 'string' && actual.includes(expected as string);
    default:         return false;
  }
}

function evaluateConditions(signal: SafetySignal, conditions: SafetyRuleCondition[]): boolean {
  if (!conditions.length) return true;
  return conditions.every(c => evaluateCondition(signal, c));
}

// ═══════════════════════════════════════════════════════
// PLAYBOOK MATCHER
// ═══════════════════════════════════════════════════════

/**
 * Find all playbooks that match a given signal.
 */
export async function matchPlaybooks(
  tenantId: string,
  signal: SafetySignal,
): Promise<SafetyPlaybook[]> {
  const { data } = await supabase
    .from('safety_playbooks' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('evento_origem', signal.source)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (!data?.length) return [];

  const now = new Date();

  return (data as any[]).filter(pb => {
    // Check severity threshold
    const signalSev = SEVERITY_ORDER[signal.severity] ?? 0;
    const minSev = SEVERITY_ORDER[pb.min_severity] ?? 0;
    if (signalSev < minSev) return false;

    // Check cooldown
    if (pb.last_triggered_at) {
      const lastTriggered = new Date(pb.last_triggered_at);
      const hoursSince = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
      if (hoursSince < pb.cooldown_hours) return false;
    }

    // Evaluate conditions
    const conditions = (pb.condicao ?? []) as SafetyRuleCondition[];
    return evaluateConditions(signal, conditions);
  }) as SafetyPlaybook[];
}

// ═══════════════════════════════════════════════════════
// PLAYBOOK EXECUTOR
// ═══════════════════════════════════════════════════════

export interface PlaybookExecutionResult {
  playbook_id: string;
  playbook_name: string;
  actions_executed: number;
  actions_failed: number;
  errors: string[];
}

/**
 * Execute all actions in a matched playbook.
 */
export async function executePlaybook(
  tenantId: string,
  playbook: SafetyPlaybook,
  signal: SafetySignal,
  executor: SafetyActionExecutorPort,
): Promise<PlaybookExecutionResult> {
  const context: ActionContext = { signal };
  const result: PlaybookExecutionResult = {
    playbook_id: playbook.id,
    playbook_name: playbook.name,
    actions_executed: 0,
    actions_failed: 0,
    errors: [],
  };

  const employeeId = signal.entity_type === 'employee' ? signal.entity_id : null;
  const actions = (playbook.acoes ?? []) as SafetyAction[];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_task':
          await executor.createTask(tenantId, action.config as any, context);
          break;
        case 'require_training':
          if (employeeId) await executor.requireTraining(tenantId, employeeId, action.config as any);
          break;
        case 'require_exam':
          if (employeeId) await executor.requireExam(tenantId, employeeId, action.config as any);
          break;
        case 'require_agreement':
          if (employeeId) await executor.requireAgreement(tenantId, employeeId, action.config as any);
          break;
        case 'notify_manager':
        case 'notify_safety_team':
          await executor.notifyUsers(tenantId, action.config as any, context);
          break;
        case 'block_employee':
          if (employeeId) await executor.blockEmployee(tenantId, employeeId, action.config as any);
          break;
        case 'escalate':
          await executor.escalate(tenantId, action.config as any, context);
          break;
        case 'create_inspection':
          await executor.scheduleInspection(tenantId, action.config as any, context);
          break;
        case 'update_risk_score':
          if (employeeId) await executor.updateRiskScore(tenantId, employeeId, action.config as any);
          break;
        default:
          break;
      }
      result.actions_executed++;
    } catch (err: unknown) {
      result.actions_failed++;
      result.errors.push(`${action.type}: ${err instanceof Error ? err.message : 'unknown error'}`);
      if (action.is_blocking) break;
    }
  }

  // Update playbook stats
  await supabase
    .from('safety_playbooks' as any)
    .update({
      trigger_count: (playbook.trigger_count ?? 0) + 1,
      last_triggered_at: new Date().toISOString(),
    } as any)
    .eq('id', playbook.id);

  return result;
}

// ═══════════════════════════════════════════════════════
// PROCESS SIGNAL THROUGH PLAYBOOKS
// ═══════════════════════════════════════════════════════

/**
 * Main entry: match signal against playbooks and execute all matches.
 */
export async function processSignalWithPlaybooks(
  tenantId: string,
  signal: SafetySignal,
  executor: SafetyActionExecutorPort,
): Promise<PlaybookExecutionResult[]> {
  const matched = await matchPlaybooks(tenantId, signal);
  if (!matched.length) return [];

  const results: PlaybookExecutionResult[] = [];
  for (const playbook of matched) {
    const r = await executePlaybook(tenantId, playbook, signal, executor);
    results.push(r);
  }
  return results;
}

// ═══════════════════════════════════════════════════════
// DEFAULT PLAYBOOK SEEDS
// ═══════════════════════════════════════════════════════

/** Seed default system playbooks for a tenant */
export function getDefaultPlaybooks(tenantId: string): Omit<SafetyPlaybook, 'id' | 'trigger_count' | 'last_triggered_at'>[] {
  return [
    {
      tenant_id: tenantId,
      name: 'NR-35 Vencida — Bloqueio + Tarefa + Termo',
      description: 'Quando treinamento NR-35 vence: cria tarefa, bloqueia operação e gera termo digital',
      evento_origem: 'training_expired',
      condicao: [{ field: 'payload.nr_number', operator: 'eq', value: 35 }],
      min_severity: 'high',
      acoes: [
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Renovar treinamento NR-35 — {{employee_name}}',
            description_template: 'Treinamento de Trabalho em Altura vencido. Agendar reciclagem imediata.',
            priority: 'urgent',
            due_in_days: 5,
            assign_to: 'rh_admin',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'block_employee',
          config: {
            type: 'block_employee',
            blocking_level: 'hard_block',
            reason_template: 'NR-35 vencida — proibido trabalho em altura até reciclagem',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'require_agreement',
          config: {
            type: 'require_agreement',
            template_slug: 'termo-ciencia-bloqueio-nr35',
            is_mandatory: true,
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      is_system: true,
      is_active: true,
      priority: 10,
      cooldown_hours: 72,
    },
    {
      tenant_id: tenantId,
      name: 'Exame Periódico Vencido — Agendar + Notificar',
      description: 'Quando exame PCMSO vence: agenda novo exame e notifica RH',
      evento_origem: 'exam_overdue',
      condicao: [],
      min_severity: 'medium',
      acoes: [
        {
          type: 'require_exam',
          config: {
            type: 'require_exam',
            exam_type: 'periodico',
            due_in_days: 15,
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'notify_safety_team',
          config: {
            type: 'notify_safety_team',
            message_template: 'Exame periódico vencido. Verificar ASO e agendar renovação.',
            channels: ['in_app', 'email'],
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      is_system: true,
      is_active: true,
      priority: 20,
      cooldown_hours: 48,
    },
    {
      tenant_id: tenantId,
      name: 'Risco Crítico — Escalação Imediata',
      description: 'Score de risco crítico: escala para admin e bloqueia colaborador',
      evento_origem: 'risk_score_degraded',
      condicao: [{ field: 'payload.risk_score', operator: 'gte', value: 85 }],
      min_severity: 'critical',
      acoes: [
        {
          type: 'block_employee',
          config: {
            type: 'block_employee',
            blocking_level: 'soft_block',
            reason_template: 'Score de risco crítico (≥85) — aguardando análise de segurança',
          },
          delay_hours: 0,
          is_blocking: true,
        },
        {
          type: 'escalate',
          config: {
            type: 'escalate',
            escalation_level: 2,
            message_template: 'Colaborador com score de risco crítico. Ação imediata necessária.',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_inspection',
          config: {
            type: 'create_inspection',
            inspection_type: 'corrective',
            due_in_days: 3,
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      is_system: true,
      is_active: true,
      priority: 5,
      cooldown_hours: 24,
    },
    {
      tenant_id: tenantId,
      name: 'EPI Vencido — Tarefa + Notificação',
      description: 'EPI com validade expirada: cria tarefa para substituição e notifica gestor',
      evento_origem: 'epi_expired',
      condicao: [],
      min_severity: 'medium',
      acoes: [
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Substituir EPI vencido — {{employee_name}}',
            description_template: 'Equipamento de proteção individual com validade expirada. Providenciar substituição.',
            priority: 'high',
            due_in_days: 3,
            assign_to: 'direct_manager',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'notify_manager',
          config: {
            type: 'notify_manager',
            message_template: 'EPI de colaborador está vencido. Providenciar substituição imediata.',
            channels: ['in_app'],
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      is_system: true,
      is_active: true,
      priority: 30,
      cooldown_hours: 72,
    },
  ];
}
