/**
 * Safety Automation Engine — Action Orchestrator
 *
 * Executes the ordered list of SafetyActions from a matched rule.
 * Delegates to the SafetyActionExecutorPort for cross-domain side-effects.
 *
 * Design: Strictly sequential execution with blocking semantics.
 * If a blocking action fails, subsequent actions are skipped.
 */

import type {
  SafetySignal,
  SafetyAction,
  SafetyActionExecutorPort,
  SafetyExecutionRecord,
  ActionExecutionResult,
  ActionContext,
  SafetyActionType,
} from './types';
import { emitSafetyEvent } from './events';

// ═══════════════════════════════════════════════════════
// TEMPLATE INTERPOLATION
// ═══════════════════════════════════════════════════════

function interpolate(template: string, context: ActionContext): string {
  return template
    .replace(/\{\{signal_title\}\}/g, context.signal.title)
    .replace(/\{\{signal_description\}\}/g, context.signal.description)
    .replace(/\{\{employee_name\}\}/g, context.employee_name ?? 'N/A')
    .replace(/\{\{company_name\}\}/g, context.company_name ?? 'N/A')
    .replace(/\{\{department_name\}\}/g, context.department_name ?? 'N/A')
    .replace(/\{\{severity\}\}/g, context.signal.severity)
    .replace(/\{\{source\}\}/g, context.signal.source)
    .replace(/\{\{entity_id\}\}/g, context.signal.entity_id);
}

// ═══════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════

export interface OrchestratorDeps {
  executor: SafetyActionExecutorPort;
}

/**
 * Execute all actions for a matched rule against a signal.
 */
export async function executeActions(
  signal: SafetySignal,
  ruleId: string,
  actions: SafetyAction[],
  context: ActionContext,
  deps: OrchestratorDeps,
): Promise<SafetyExecutionRecord> {
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const results: ActionExecutionResult[] = [];
  let overallStatus: SafetyExecutionRecord['status'] = 'running';
  let blocked = false;

  for (const action of actions) {
    if (blocked) {
      results.push({
        action_type: action.type,
        status: 'skipped',
        created_entity_id: null,
        error: 'Skipped due to previous blocking action failure',
        executed_at: new Date().toISOString(),
      });
      continue;
    }

    // Apply delay (simulated — in production would be deferred)
    // For now, delays are recorded but executed immediately

    const result = await executeSingleAction(
      signal,
      action,
      context,
      deps.executor,
    );

    results.push(result);

    emitSafetyEvent({
      type: 'SafetyActionExecuted',
      timestamp: Date.now(),
      tenant_id: signal.tenant_id,
      signal_id: signal.id,
      rule_id: ruleId,
      action_type: action.type,
      status: result.status,
      created_entity_id: result.created_entity_id,
    });

    // Check if blocking action failed
    if (action.is_blocking && result.status === 'failed') {
      blocked = true;
    }
  }

  const completedAt = new Date().toISOString();
  const succeeded = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  overallStatus = failed > 0
    ? (succeeded > 0 ? 'completed' : 'failed')  // partial success still = completed
    : 'completed';

  const record: SafetyExecutionRecord = {
    id: executionId,
    tenant_id: signal.tenant_id,
    signal_id: signal.id,
    rule_id: ruleId,
    action_results: results,
    status: overallStatus,
    started_at: startedAt,
    completed_at: completedAt,
    error_message: failed > 0 ? `${failed}/${results.length} actions failed` : null,
    duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    created_at: startedAt,
  };

  emitSafetyEvent({
    type: 'SafetyExecutionCompleted',
    timestamp: Date.now(),
    tenant_id: signal.tenant_id,
    execution_id: executionId,
    signal_id: signal.id,
    rule_id: ruleId,
    status: overallStatus,
    actions_total: results.length,
    actions_succeeded: succeeded,
    actions_failed: failed,
    duration_ms: record.duration_ms ?? 0,
  });

  return record;
}

// ═══════════════════════════════════════════════════════
// SINGLE ACTION EXECUTION
// ═══════════════════════════════════════════════════════

async function executeSingleAction(
  signal: SafetySignal,
  action: SafetyAction,
  context: ActionContext,
  executor: SafetyActionExecutorPort,
): Promise<ActionExecutionResult> {
  const now = new Date().toISOString();
  const config = action.config;
  const tenantId = signal.tenant_id;
  const employeeId = signal.entity_type === 'employee' ? signal.entity_id : '';

  try {
    let createdEntityId: string | null = null;

    switch (config.type) {
      case 'create_task': {
        const resolved = {
          ...config,
          title_template: interpolate(config.title_template, context),
          description_template: interpolate(config.description_template, context),
        };
        createdEntityId = await executor.createTask(tenantId, resolved, context);
        break;
      }

      case 'require_training':
        createdEntityId = await executor.requireTraining(tenantId, employeeId, config);
        break;

      case 'require_exam':
        createdEntityId = await executor.requireExam(tenantId, employeeId, config);
        break;

      case 'require_agreement':
        createdEntityId = await executor.requireAgreement(tenantId, employeeId, config);
        break;

      case 'notify_manager':
      case 'notify_safety_team': {
        const resolved = {
          ...config,
          message_template: interpolate(config.message_template, context),
        };
        await executor.notifyUsers(tenantId, resolved, context);
        break;
      }

      case 'block_employee': {
        const resolved = {
          ...config,
          reason_template: interpolate(config.reason_template, context),
        };
        await executor.blockEmployee(tenantId, employeeId, resolved);

        emitSafetyEvent({
          type: 'SafetyEmployeeBlocked',
          timestamp: Date.now(),
          tenant_id: tenantId,
          employee_id: employeeId,
          blocking_level: config.blocking_level,
          reason: resolved.reason_template,
          signal_id: signal.id,
        });
        break;
      }

      case 'escalate': {
        const resolved = {
          ...config,
          message_template: interpolate(config.message_template, context),
        };
        await executor.escalate(tenantId, resolved, context);

        emitSafetyEvent({
          type: 'SafetyEscalationTriggered',
          timestamp: Date.now(),
          tenant_id: tenantId,
          signal_id: signal.id,
          escalation_level: config.escalation_level,
          reason: resolved.message_template,
        });
        break;
      }

      case 'create_inspection':
        createdEntityId = await executor.scheduleInspection(tenantId, config, context);
        break;

      case 'update_risk_score':
        await executor.updateRiskScore(tenantId, signal.entity_id, config);
        break;

      case 'log_event':
        // Log events are inherently handled by the execution record itself
        break;

      default:
        throw new Error(`Unknown action type: ${(config as { type: string }).type}`);
    }

    return {
      action_type: action.type,
      status: 'completed',
      created_entity_id: createdEntityId,
      error: null,
      executed_at: now,
    };
  } catch (err) {
    console.error(`[SafetyAutomation] Action ${action.type} failed:`, err);
    return {
      action_type: action.type,
      status: 'failed',
      created_entity_id: null,
      error: err instanceof Error ? err.message : String(err),
      executed_at: now,
    };
  }
}
