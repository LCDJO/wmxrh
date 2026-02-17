/**
 * Automation Engine Service
 *
 * Evaluates rules against incoming events, executes actions,
 * and logs execution results. Hooks into GlobalEventKernel.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { AutomationRule, RuleCondition, RuleAction } from './automation.types';

// ══════════════════════════════════════════════════════════════════
// CRUD
// ══════════════════════════════════════════════════════════════════

export async function fetchAutomationRules(tenantId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createAutomationRule(
  rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at' | 'last_triggered_at' | 'trigger_count'>
): Promise<AutomationRule> {
  const row = {
    tenant_id: rule.tenant_id,
    name: rule.name,
    description: rule.description,
    trigger_event: rule.trigger_event,
    conditions: JSON.parse(JSON.stringify(rule.conditions)) as Json,
    actions: JSON.parse(JSON.stringify(rule.actions)) as Json,
    is_active: rule.is_active,
    priority: rule.priority,
    created_by: rule.created_by,
  };
  const { data, error } = await supabase
    .from('automation_rules')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateAutomationRule(
  id: string,
  updates: Partial<Pick<AutomationRule, 'name' | 'description' | 'trigger_event' | 'conditions' | 'actions' | 'is_active' | 'priority'>>
): Promise<AutomationRule> {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.conditions) payload.conditions = JSON.parse(JSON.stringify(updates.conditions)) as Json;
  if (updates.actions) payload.actions = JSON.parse(JSON.stringify(updates.actions)) as Json;

  const { data, error } = await supabase
    .from('automation_rules')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteAutomationRule(id: string): Promise<void> {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleAutomationRule(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from('automation_rules').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════
// Execution log
// ══════════════════════════════════════════════════════════════════

export async function fetchRuleExecutions(ruleId: string, limit = 20) {
  const { data, error } = await supabase
    .from('automation_rule_executions')
    .select('*')
    .eq('rule_id', ruleId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ══════════════════════════════════════════════════════════════════
// Rule Evaluation Engine
// ══════════════════════════════════════════════════════════════════

export function evaluateConditions(conditions: RuleCondition[], payload: Record<string, unknown>): boolean {
  if (conditions.length === 0) return true;

  return conditions.every(cond => {
    const fieldValue = getNestedValue(payload, cond.field);
    return evaluateSingleCondition(fieldValue, cond.operator, cond.value);
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateSingleCondition(fieldValue: unknown, operator: RuleCondition['operator'], condValue: RuleCondition['value']): boolean {
  switch (operator) {
    case '==': return fieldValue == condValue;
    case '!=': return fieldValue != condValue;
    case '>': return Number(fieldValue) > Number(condValue);
    case '>=': return Number(fieldValue) >= Number(condValue);
    case '<': return Number(fieldValue) < Number(condValue);
    case '<=': return Number(fieldValue) <= Number(condValue);
    case 'contains': return String(fieldValue).includes(String(condValue));
    case 'not_contains': return !String(fieldValue).includes(String(condValue));
    case 'in': return Array.isArray(condValue) && condValue.includes(String(fieldValue));
    case 'not_in': return Array.isArray(condValue) && !condValue.includes(String(fieldValue));
    case 'exists': return fieldValue !== undefined && fieldValue !== null;
    case 'not_exists': return fieldValue === undefined || fieldValue === null;
    default: return false;
  }
}

export async function executeActions(actions: RuleAction[], payload: Record<string, unknown>, _tenantId: string): Promise<RuleAction[]> {
  const executed: RuleAction[] = [];

  for (const action of actions) {
    try {
      // In a real implementation, each action type would have a dedicated handler.
      // For now, we log and mark as executed.
      console.log(`[AutomationEngine] Executing action: ${action.type}`, action.config, payload);
      executed.push(action);
    } catch (err) {
      console.error(`[AutomationEngine] Action ${action.type} failed:`, err);
    }
  }

  return executed;
}

export async function logExecution(
  ruleId: string,
  tenantId: string,
  triggerEvent: string,
  triggerPayload: unknown,
  conditionsMet: boolean,
  actionsExecuted: RuleAction[],
  result: 'success' | 'partial' | 'failure',
  errorMessage?: string,
) {
  const row = {
    rule_id: ruleId,
    tenant_id: tenantId,
    trigger_event: triggerEvent,
    trigger_payload: (triggerPayload ? JSON.parse(JSON.stringify(triggerPayload)) : null) as Json,
    conditions_met: conditionsMet,
    actions_executed: JSON.parse(JSON.stringify(actionsExecuted)) as Json,
    result,
    error_message: errorMessage ?? null,
  };
  await supabase.from('automation_rule_executions').insert([row]);
}

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

function mapRow(row: Record<string, unknown>): AutomationRule {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    trigger_event: row.trigger_event as string,
    conditions: (row.conditions ?? []) as RuleCondition[],
    actions: (row.actions ?? []) as RuleAction[],
    is_active: row.is_active as boolean,
    priority: row.priority as number,
    last_triggered_at: (row.last_triggered_at as string) ?? null,
    trigger_count: (row.trigger_count as number) ?? 0,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
