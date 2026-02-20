/**
 * Safety Automation Engine — Signal Processor
 *
 * Main orchestrator that:
 *   1. Receives a SafetySignal
 *   2. Matches it to automation rules
 *   3. Executes matched actions
 *   4. Records execution results
 *
 * This is the primary entry point for the Safety Automation Engine.
 */

import type {
  SafetySignal,
  SafetyAutomationRule,
  SafetyActionExecutorPort,
  SafetyExecutionRecord,
  ActionContext,
  SafetySignalSource,
  SafetySignalSeverity,
} from './types';
import { matchSignalToRules } from './rule-engine';
import { executeActions } from './action-orchestrator';
import { emitSafetyEvent } from './events';

// ═══════════════════════════════════════════════════════
// SIGNAL PROCESSOR SERVICE
// ═══════════════════════════════════════════════════════

export interface SignalProcessorDeps {
  /** Load active rules for a tenant */
  loadRules(tenantId: string): SafetyAutomationRule[];
  /** Executor port for cross-domain actions */
  executor: SafetyActionExecutorPort;
  /** Resolve context info for template interpolation */
  resolveContext?(signal: SafetySignal): Promise<ActionContext>;
  /** Persist execution record (optional — for audit trail) */
  persistExecution?(record: SafetyExecutionRecord): Promise<void>;
}

/**
 * Create a new SafetySignal from raw inputs.
 */
export function createSignal(
  tenantId: string,
  source: SafetySignalSource,
  severity: SafetySignalSeverity,
  entityType: SafetySignal['entity_type'],
  entityId: string,
  title: string,
  description: string,
  payload: Record<string, unknown> = {},
  companyId?: string | null,
): SafetySignal {
  const signal: SafetySignal = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    company_id: companyId ?? null,
    source,
    severity,
    entity_type: entityType,
    entity_id: entityId,
    title,
    description,
    payload,
    processed: false,
    processed_at: null,
    matched_rule_id: null,
    created_at: new Date().toISOString(),
  };

  emitSafetyEvent({
    type: 'SafetySignalReceived',
    timestamp: Date.now(),
    tenant_id: tenantId,
    signal_id: signal.id,
    source,
    severity,
    entity_type: entityType,
    entity_id: entityId,
  });

  return signal;
}

/**
 * Process a safety signal end-to-end:
 *   1. Match to rules
 *   2. Execute actions
 *   3. Return execution record (or null if no rule matched)
 */
export async function processSignal(
  signal: SafetySignal,
  deps: SignalProcessorDeps,
): Promise<SafetyExecutionRecord | null> {
  // 1. Load rules
  const rules = deps.loadRules(signal.tenant_id);

  // 2. Match signal
  const match = matchSignalToRules(signal, rules);

  if (!match) {
    signal.processed = true;
    signal.processed_at = new Date().toISOString();
    return null;
  }

  // 3. Emit match event
  emitSafetyEvent({
    type: 'SafetyRuleMatched',
    timestamp: Date.now(),
    tenant_id: signal.tenant_id,
    signal_id: signal.id,
    rule_id: match.rule.id,
    rule_name: match.rule.name,
    action_count: match.rule.actions.length,
  });

  // 4. Resolve context
  const context: ActionContext = deps.resolveContext
    ? await deps.resolveContext(signal)
    : { signal };

  // 5. Execute actions
  const record = await executeActions(
    signal,
    match.rule.id,
    match.rule.actions,
    context,
    { executor: deps.executor },
  );

  // 6. Mark signal as processed
  signal.processed = true;
  signal.processed_at = new Date().toISOString();
  signal.matched_rule_id = match.rule.id;

  // 7. Persist execution
  if (deps.persistExecution) {
    await deps.persistExecution(record);
  }

  return record;
}
