/**
 * Automation Rule Engine — Domain Types
 *
 * Low-code rule definitions: trigger → conditions → actions.
 * Integrates with GlobalEventKernel for real-time event matching.
 */

// ══════════════════════════════════════════════════════════════════
// Condition Operators
// ══════════════════════════════════════════════════════════════════

export type ConditionOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

// ══════════════════════════════════════════════════════════════════
// Actions
// ══════════════════════════════════════════════════════════════════

export type ActionType =
  | 'notify_platform_admin'
  | 'notify_tenant_admin'
  | 'trigger_self_healing'
  | 'emit_event'
  | 'disable_module'
  | 'enable_module'
  | 'escalate_risk'
  | 'log_audit'
  | 'webhook';

export interface RuleAction {
  type: ActionType;
  config: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// Rule Definition
// ══════════════════════════════════════════════════════════════════

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  priority: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleExecution {
  id: string;
  rule_id: string;
  tenant_id: string;
  trigger_event: string;
  trigger_payload: unknown;
  conditions_met: boolean;
  actions_executed: RuleAction[];
  result: 'success' | 'partial' | 'failure';
  error_message: string | null;
  executed_at: string;
}

// ══════════════════════════════════════════════════════════════════
// Catalog of known events & actions for the UI
// ══════════════════════════════════════════════════════════════════

export interface TriggerEventOption {
  value: string;
  label: string;
  description: string;
  payload_fields: string[];
}

export interface ActionTypeOption {
  value: ActionType;
  label: string;
  description: string;
  config_fields: Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }>;
}

export const TRIGGER_EVENT_CATALOG: TriggerEventOption[] = [
  { value: 'module.status_changed', label: 'Status do módulo alterado', description: 'Disparado quando um módulo muda de status', payload_fields: ['module_key', 'module_status', 'previous_status'] },
  { value: 'risk.score_changed', label: 'Score de risco alterado', description: 'Disparado quando o score de risco muda', payload_fields: ['risk_score', 'risk_level', 'previous_score'] },
  { value: 'security.permission_granted', label: 'Permissão concedida', description: 'Disparado quando uma nova permissão é atribuída', payload_fields: ['user_id', 'permission', 'role'] },
  { value: 'security.anomaly_detected', label: 'Anomalia detectada', description: 'Disparado quando o UGE detecta anomalia', payload_fields: ['anomaly_kind', 'severity', 'affected_count'] },
  { value: 'compliance.violation_detected', label: 'Violação de compliance', description: 'Disparado quando uma regra de compliance é violada', payload_fields: ['rule_code', 'severity', 'violation_count'] },
  { value: 'tenant.user_login', label: 'Login de usuário', description: 'Disparado quando um usuário faz login', payload_fields: ['user_id', 'tenant_id', 'ip_address'] },
  { value: 'system.health_degraded', label: 'Saúde do sistema degradada', description: 'Disparado quando a saúde geral degrada', payload_fields: ['overall_status', 'failing_checks'] },
];

export const ACTION_TYPE_CATALOG: ActionTypeOption[] = [
  { value: 'notify_platform_admin', label: 'Notificar Admin da Plataforma', description: 'Envia notificação para admins da plataforma', config_fields: [{ key: 'message', label: 'Mensagem', type: 'text' }] },
  { value: 'notify_tenant_admin', label: 'Notificar Admin do Tenant', description: 'Envia notificação para admins do tenant', config_fields: [{ key: 'message', label: 'Mensagem', type: 'text' }] },
  { value: 'trigger_self_healing', label: 'Disparar Self-Healing', description: 'Tenta recuperar módulo automaticamente', config_fields: [{ key: 'module_key', label: 'Módulo', type: 'text' }] },
  { value: 'emit_event', label: 'Emitir Evento', description: 'Emite um novo evento no kernel', config_fields: [{ key: 'event_type', label: 'Tipo do Evento', type: 'text' }, { key: 'payload', label: 'Payload (JSON)', type: 'text' }] },
  { value: 'disable_module', label: 'Desabilitar Módulo', description: 'Desativa um módulo específico', config_fields: [{ key: 'module_key', label: 'Módulo', type: 'text' }] },
  { value: 'escalate_risk', label: 'Escalar Risco', description: 'Eleva o nível de risco', config_fields: [{ key: 'target_level', label: 'Nível', type: 'select', options: ['medium', 'high', 'critical'] }] },
  { value: 'log_audit', label: 'Registrar Auditoria', description: 'Grava entrada no log de auditoria', config_fields: [{ key: 'action', label: 'Ação', type: 'text' }] },
  { value: 'webhook', label: 'Chamar Webhook', description: 'Faz chamada HTTP externa', config_fields: [{ key: 'url', label: 'URL', type: 'text' }, { key: 'method', label: 'Método', type: 'select', options: ['POST', 'PUT', 'PATCH'] }] },
];
