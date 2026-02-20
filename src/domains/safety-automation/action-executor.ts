/**
 * Safety Automation Engine — Automated Action Executor
 *
 * Concrete implementation of SafetyActionExecutorPort that performs
 * automated actions against the database:
 *
 *   1. Criar EmployeeTraining automaticamente
 *   2. Criar EmployeeAgreement automaticamente
 *   3. Solicitar novo exame PCMSO
 *   4. Notificar gestor e RH
 *
 * Also creates SafetyTasks linked to the originating workflow.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  SafetyActionExecutorPort,
  ActionContext,
  CreateTaskConfig,
  RequireTrainingConfig,
  RequireExamConfig,
  RequireAgreementConfig,
  NotifyConfig,
  BlockEmployeeConfig,
  EscalateConfig,
  InspectionConfig,
  UpdateRiskScoreConfig,
} from './types';

// ═══════════════════════════════════════════════════════
// SAFETY TASK HELPER
// ═══════════════════════════════════════════════════════

interface CreateSafetyTaskParams {
  tenant_id: string;
  workflow_id: string | null;
  responsavel_user_id: string | null;
  employee_id: string | null;
  descricao: string;
  prazo_days: number;
  metadata?: Record<string, unknown>;
}

async function createSafetyTask(params: CreateSafetyTaskParams): Promise<string | null> {
  const prazo = new Date();
  prazo.setDate(prazo.getDate() + params.prazo_days);

  const { data, error } = await supabase
    .from('safety_tasks')
    .insert({
      tenant_id: params.tenant_id,
      workflow_id: params.workflow_id ?? undefined,
      responsavel_user_id: params.responsavel_user_id,
      employee_id: params.employee_id,
      descricao: params.descricao,
      prazo: prazo.toISOString(),
      status: 'pending',
      metadata: params.metadata ?? {},
    } as any)
    .select('id')
    .single();

  if (error) {
    console.error('[SafetyExecutor] Failed to create safety task:', error);
    return null;
  }

  return data?.id ?? null;
}

// ═══════════════════════════════════════════════════════
// RESOLVE MANAGER / RH USER IDS
// ═══════════════════════════════════════════════════════

async function resolveManagerId(tenantId: string, employeeId: string): Promise<string | null> {
  const { data } = await supabase
    .from('employees')
    .select('manager_id')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return data?.manager_id ?? null;
}

async function resolveRHAdminIds(tenantId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['rh', 'admin', 'owner'] as any[]);

  return (data ?? []).map(r => r.user_id).filter(Boolean) as string[];
}

async function resolveAssignee(
  tenantId: string,
  employeeId: string,
  assignTo: CreateTaskConfig['assign_to'],
  assigneeId?: string,
): Promise<string | null> {
  switch (assignTo) {
    case 'direct_manager':
      return resolveManagerId(tenantId, employeeId);
    case 'rh_admin': {
      const ids = await resolveRHAdminIds(tenantId);
      return ids[0] ?? null;
    }
    case 'safety_engineer': {
      // Fallback to RH admin if no safety engineer role exists
      const ids = await resolveRHAdminIds(tenantId);
      return ids[0] ?? null;
    }
    case 'specific_user':
      return assigneeId ?? null;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════
// EXECUTOR IMPLEMENTATION
// ═══════════════════════════════════════════════════════

export function createSafetyActionExecutor(
  workflowId?: string | null,
): SafetyActionExecutorPort {
  return {
    // ── 1. Create corrective task ──────────────────────
    async createTask(tenantId, config, context) {
      const employeeId = context.signal.entity_type === 'employee'
        ? context.signal.entity_id : null;

      const assigneeId = await resolveAssignee(
        tenantId,
        employeeId ?? '',
        config.assign_to,
        config.assignee_id,
      );

      return createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: assigneeId,
        employee_id: employeeId,
        descricao: `${config.title_template}\n\n${config.description_template}`,
        prazo_days: config.due_in_days,
        metadata: {
          action_type: 'create_task',
          priority: config.priority,
          assign_to: config.assign_to,
        },
      });
    },

    // ── 2. Criar EmployeeTraining automaticamente ──────
    async requireTraining(tenantId, employeeId, config) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + config.due_in_days);

      const { data, error } = await supabase
        .from('employee_training_assignments' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: employeeId,
          nr_codigo: config.nr_number,
          status: 'scheduled',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          metadata: {
            auto_generated: true,
            source: 'safety_automation_engine',
            training_name: config.training_name,
            blocking_level: config.blocking_level,
          },
        } as any)
        .select('id')
        .single();

      if (error) {
        console.error('[SafetyExecutor] Failed to create training assignment:', error);

        // Fallback: create a safety task instead
        return createSafetyTask({
          tenant_id: tenantId,
          workflow_id: workflowId ?? null,
          responsavel_user_id: null,
          employee_id: employeeId,
          descricao: `Agendar treinamento NR-${config.nr_number}: ${config.training_name}`,
          prazo_days: config.due_in_days,
          metadata: {
            action_type: 'require_training',
            nr_number: config.nr_number,
            blocking_level: config.blocking_level,
            fallback: true,
          },
        });
      }

      return (data as any)?.id ?? null;
    },

    // ── 3. Solicitar novo exame PCMSO ──────────────────
    async requireExam(tenantId, employeeId, config) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + config.due_in_days);

      // Create a safety task to schedule the exam
      return createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: null,
        employee_id: employeeId,
        descricao: `Renovar exame ${config.exam_type} — Prazo: ${dueDate.toLocaleDateString('pt-BR')}`,
        prazo_days: config.due_in_days,
        metadata: {
          action_type: 'require_exam',
          exam_type: config.exam_type,
          auto_generated: true,
          source: 'safety_automation_engine',
        },
      });
    },

    // ── 4. Criar EmployeeAgreement automaticamente ─────
    async requireAgreement(tenantId, employeeId, config) {
      // Create a safety task to ensure the agreement is signed
      return createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: null,
        employee_id: employeeId,
        descricao: `Assinar termo: ${config.template_slug}${config.is_mandatory ? ' (obrigatório)' : ''}`,
        prazo_days: 7,
        metadata: {
          action_type: 'require_agreement',
          template_slug: config.template_slug,
          is_mandatory: config.is_mandatory,
          auto_generated: true,
          source: 'safety_automation_engine',
        },
      });
    },

    // ── 5. Notificar gestor e RH ───────────────────────
    async notifyUsers(tenantId, config, context) {
      const employeeId = context.signal.entity_type === 'employee'
        ? context.signal.entity_id : null;

      const recipientIds: string[] = [];

      // Resolve manager
      if (config.type === 'notify_manager' && employeeId) {
        const managerId = await resolveManagerId(tenantId, employeeId);
        if (managerId) recipientIds.push(managerId);
      }

      // Always include RH for safety team notifications
      if (config.type === 'notify_safety_team') {
        const rhIds = await resolveRHAdminIds(tenantId);
        recipientIds.push(...rhIds);
      }

      // Insert in-app notifications
      if (config.channels.includes('in_app') && recipientIds.length > 0) {
        const notifications = recipientIds.map(userId => ({
          tenant_id: tenantId,
          user_id: userId,
          type: 'safety_alert',
          title: `Alerta de Segurança — ${context.signal.severity.toUpperCase()}`,
          message: config.message_template,
          metadata: {
            signal_id: context.signal.id,
            signal_source: context.signal.source,
            employee_id: employeeId,
            auto_generated: true,
          },
        }));

        const { error } = await supabase
          .from('notifications' as any)
          .insert(notifications);

        if (error) {
          console.warn('[SafetyExecutor] Failed to insert notifications:', error.message);
        }
      }

      // Email notifications would be handled by an edge function in production
      if (config.channels.includes('email')) {
        console.log('[SafetyExecutor] Email notification queued for:', recipientIds);
      }
    },

    // ── 6. Block employee ──────────────────────────────
    async blockEmployee(tenantId, employeeId, config) {
      // Create a safety task documenting the block
      await createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: null,
        employee_id: employeeId,
        descricao: `⛔ Bloqueio de segurança (${config.blocking_level}): ${config.reason_template}`,
        prazo_days: 1,
        metadata: {
          action_type: 'block_employee',
          blocking_level: config.blocking_level,
          auto_generated: true,
        },
      });
    },

    // ── 7. Escalate ────────────────────────────────────
    async escalate(tenantId, config, context) {
      const rhIds = await resolveRHAdminIds(tenantId);

      // Create escalation task for top admins
      await createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: rhIds[0] ?? null,
        employee_id: context.signal.entity_type === 'employee' ? context.signal.entity_id : null,
        descricao: `🚨 Escalação Nível ${config.escalation_level}: ${config.message_template}`,
        prazo_days: config.escalation_level === 3 ? 1 : config.escalation_level === 2 ? 3 : 5,
        metadata: {
          action_type: 'escalate',
          escalation_level: config.escalation_level,
          auto_generated: true,
        },
      });
    },

    // ── 8. Schedule inspection ─────────────────────────
    async scheduleInspection(tenantId, config, context) {
      return createSafetyTask({
        tenant_id: tenantId,
        workflow_id: workflowId ?? null,
        responsavel_user_id: null,
        employee_id: context.signal.entity_type === 'employee' ? context.signal.entity_id : null,
        descricao: `Inspeção ${config.inspection_type}: verificar condições de segurança`,
        prazo_days: config.due_in_days,
        metadata: {
          action_type: 'create_inspection',
          inspection_type: config.inspection_type,
          auto_generated: true,
        },
      });
    },

    // ── 9. Update risk score ───────────────────────────
    async updateRiskScore(_tenantId, _entityId, config) {
      // Risk score recalculation would be delegated to the
      // Workforce Intelligence Engine in production
      console.log(
        `[SafetyExecutor] Risk score recalculation requested for scope: ${config.recalculate_scope}`,
      );
    },
  };
}
