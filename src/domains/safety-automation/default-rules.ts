/**
 * Safety Automation Engine — Default Rules
 *
 * Built-in safety automation rules seeded for new tenants.
 * These encode Brazilian occupational safety best practices
 * based on CLT, NR regulations and PCMSO/PGR requirements.
 */

import type { SafetyAutomationRule } from './types';

const now = new Date().toISOString();

/**
 * Generate default safety automation rules for a given tenant.
 */
export function getDefaultSafetyRules(tenantId: string): SafetyAutomationRule[] {
  return [
    // ───────────────────────────────────────────────────
    // RULE 1: Treinamento NR vencido → Bloquear + Notificar
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Treinamento NR vencido — Bloqueio e notificação',
      description: 'Quando um treinamento obrigatório expira, bloqueia parcialmente o colaborador e notifica o gestor.',
      trigger_sources: ['training_expired'],
      min_severity: 'high',
      conditions: [],
      actions: [
        {
          type: 'block_employee',
          config: {
            type: 'block_employee',
            blocking_level: 'soft_block',
            reason_template: 'Treinamento NR obrigatório vencido: {{signal_title}}',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'require_training',
          config: {
            type: 'require_training',
            nr_number: 0, // Will be populated from signal payload
            training_name: 'Reciclagem obrigatória',
            due_in_days: 30,
            blocking_level: 'soft_block',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'notify_manager',
          config: {
            type: 'notify_manager',
            message_template: '⚠️ {{employee_name}} possui treinamento NR vencido: {{signal_title}}. Ação corretiva necessária.',
            channels: ['in_app', 'email'],
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Agendar reciclagem NR — {{employee_name}}',
            description_template: '{{signal_description}}. Providenciar agendamento dentro de 30 dias.',
            priority: 'high',
            due_in_days: 7,
            assign_to: 'safety_engineer',
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 1,
      status: 'active',
      cooldown_hours: 168, // 7 days
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },

    // ───────────────────────────────────────────────────
    // RULE 2: Exame periódico vencido → Exigir ASO + Notificar
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Exame periódico vencido — Exigir ASO',
      description: 'Quando o exame periódico de um colaborador vence, exige novo ASO e notifica RH.',
      trigger_sources: ['exam_overdue'],
      min_severity: 'high',
      conditions: [],
      actions: [
        {
          type: 'require_exam',
          config: {
            type: 'require_exam',
            exam_type: 'periodico',
            due_in_days: 15,
          },
          delay_hours: 0,
          is_blocking: true,
        },
        {
          type: 'notify_safety_team',
          config: {
            type: 'notify_safety_team',
            message_template: '🏥 {{employee_name}} está com exame periódico vencido. Novo ASO deve ser realizado em até 15 dias.',
            channels: ['in_app'],
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 2,
      status: 'active',
      cooldown_hours: 336, // 14 days
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },

    // ───────────────────────────────────────────────────
    // RULE 3: Nova exposição a risco → Termo + Treinamento
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Nova exposição a risco — Termo e treinamento',
      description: 'Quando um colaborador recebe nova exposição a risco, solicita assinatura de termo de ciência e agenda treinamento.',
      trigger_sources: ['occupational_risk'],
      min_severity: 'medium',
      conditions: [],
      actions: [
        {
          type: 'require_agreement',
          config: {
            type: 'require_agreement',
            template_slug: 'termo-ciencia-risco',
            is_mandatory: true,
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Avaliar treinamento para {{employee_name}} — nova exposição a risco',
            description_template: '{{signal_description}}. Verificar necessidade de treinamento específico.',
            priority: 'medium',
            due_in_days: 10,
            assign_to: 'safety_engineer',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'update_risk_score',
          config: {
            type: 'update_risk_score',
            recalculate_scope: 'employee',
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 3,
      status: 'active',
      cooldown_hours: 24,
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },

    // ───────────────────────────────────────────────────
    // RULE 4: Violação de compliance → Escalação
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Violação de compliance crítica — Escalação',
      description: 'Violações críticas de compliance são escaladas para a gestão e geram inspeção corretiva.',
      trigger_sources: ['compliance_violation'],
      min_severity: 'critical',
      conditions: [],
      actions: [
        {
          type: 'escalate',
          config: {
            type: 'escalate',
            escalation_level: 2,
            message_template: '🚨 CRÍTICO: Violação de compliance detectada — {{signal_title}} | {{company_name}}',
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
        {
          type: 'log_event',
          config: {
            type: 'log_event',
            event_category: 'compliance_escalation',
            event_message_template: 'Violação crítica escalada: {{signal_title}}',
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 0,
      status: 'active',
      cooldown_hours: 4,
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },

    // ───────────────────────────────────────────────────
    // RULE 5: Transferência de colaborador → Reavaliar riscos
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Transferência — Reavaliar riscos e treinamentos',
      description: 'Quando um colaborador é transferido, reavalia exposição a riscos e exige exame de mudança de função.',
      trigger_sources: ['employee_transferred'],
      min_severity: 'medium',
      conditions: [],
      actions: [
        {
          type: 'require_exam',
          config: {
            type: 'require_exam',
            exam_type: 'mudanca_funcao',
            due_in_days: 10,
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'update_risk_score',
          config: {
            type: 'update_risk_score',
            recalculate_scope: 'employee',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Reavaliar treinamentos obrigatórios — {{employee_name}}',
            description_template: 'Colaborador transferido. Verificar novos requisitos de NR e PPE conforme novo setor.',
            priority: 'medium',
            due_in_days: 5,
            assign_to: 'safety_engineer',
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 4,
      status: 'active',
      cooldown_hours: 48,
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },

    // ───────────────────────────────────────────────────
    // RULE 6: Incidente reportado → Investigação completa
    // ───────────────────────────────────────────────────
    {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: 'Incidente — Investigação e ações corretivas',
      description: 'Após relato de acidente ou quase-acidente, inicia fluxo de investigação completo.',
      trigger_sources: ['incident_reported'],
      min_severity: 'high',
      conditions: [],
      actions: [
        {
          type: 'escalate',
          config: {
            type: 'escalate',
            escalation_level: 1,
            message_template: '🚨 Incidente reportado: {{signal_title}} | {{employee_name}} | {{company_name}}',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_inspection',
          config: {
            type: 'create_inspection',
            inspection_type: 'incident',
            due_in_days: 1,
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'create_task',
          config: {
            type: 'create_task',
            title_template: 'Investigar incidente — {{employee_name}}',
            description_template: '{{signal_description}}. Realizar investigação de causa raiz e definir ações preventivas.',
            priority: 'urgent',
            due_in_days: 3,
            assign_to: 'safety_engineer',
          },
          delay_hours: 0,
          is_blocking: false,
        },
        {
          type: 'notify_safety_team',
          config: {
            type: 'notify_safety_team',
            message_template: 'Incidente registrado: {{signal_title}}. Investigação imediata necessária.',
            channels: ['in_app', 'email'],
          },
          delay_hours: 0,
          is_blocking: false,
        },
      ],
      priority: 0,
      status: 'active',
      cooldown_hours: 1,
      trigger_count: 0,
      last_triggered_at: null,
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ];
}
