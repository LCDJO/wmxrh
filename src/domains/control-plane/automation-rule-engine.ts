/**
 * AutomationRuleEngine — Evaluates triggers from GlobalEventKernel
 * and dispatches automated actions through the ActionOrchestrator.
 *
 * SECURITY INVARIANT: Only operates on logical infrastructure.
 * Never mutates roles, permissions, plans, or RLS policies.
 */

import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';
import type {
  AutomationRule,
  AutomationTriggerType,
  AutomationExecutionResult,
  ControlAction,
} from './types';
import type { ActionOrchestrator } from './action-orchestrator';

export class AutomationRuleEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private disposers: Array<() => void> = [];
  private executionLog: AutomationExecutionResult[] = [];
  private idCounter = 0;

  constructor(
    private events: GlobalEventKernelAPI,
    private actions: ActionOrchestrator,
  ) {}

  start(): void {
    // Listen for platform events and match against rules
    const triggerEventMap: Record<AutomationTriggerType, string[]> = {
      incident_detected: ['selfhealing:incident_detected'],
      circuit_opened: ['selfhealing:circuit_opened'],
      module_error: ['module:error', 'module:deactivated'],
      risk_threshold: ['governance:risk_detected'],
      health_degraded: ['observability:module_health_changed'],
      error_spike: ['observability:error_rate_spike'],
      latency_threshold: ['observability:latency_threshold_exceeded'],
      manual: [],
    };

    for (const [trigger, eventTypes] of Object.entries(triggerEventMap)) {
      for (const eventType of eventTypes) {
        const unsub = this.events.on(eventType, (evt) => {
          this.evaluateTrigger(trigger as AutomationTriggerType, evt.payload);
        });
        this.disposers.push(unsub);
      }
    }
  }

  stop(): void {
    this.disposers.forEach(fn => fn());
    this.disposers.length = 0;
  }

  addRule(rule: Omit<AutomationRule, 'id' | 'last_triggered_at' | 'trigger_count' | 'created_at'>): string {
    const id = `rule-${++this.idCounter}-${Date.now().toString(36)}`;
    const full: AutomationRule = {
      ...rule,
      id,
      last_triggered_at: null,
      trigger_count: 0,
      created_at: Date.now(),
    };
    this.rules.set(id, full);
    return id;
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = enabled;
  }

  listRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  getExecutionLog(): AutomationExecutionResult[] {
    return this.executionLog.slice(-50);
  }

  private evaluateTrigger(trigger: AutomationTriggerType, payload: unknown): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.trigger !== trigger) continue;

      // Cooldown check
      if (rule.last_triggered_at && (Date.now() - rule.last_triggered_at) < rule.cooldown_ms) {
        continue;
      }

      // Match trigger config (simple key matching for now)
      if (!this.matchesConfig(rule.trigger_config, payload)) continue;

      // Execute actions
      const results: AutomationExecutionResult['actions_executed'] = [];
      for (const action of rule.actions) {
        const controlAction = this.mapToControlAction(action.type, action.config);
        if (controlAction) {
          const result = this.actions.execute(controlAction);
          results.push({ type: action.type, success: result.success, message: result.message });
        } else {
          results.push({ type: action.type, success: false, message: 'Unknown action type' });
        }
      }

      rule.last_triggered_at = Date.now();
      rule.trigger_count++;

      const execResult: AutomationExecutionResult = {
        rule_id: rule.id,
        triggered_at: Date.now(),
        actions_executed: results,
        overall_success: results.every(r => r.success),
      };
      this.executionLog.push(execResult);
      if (this.executionLog.length > 200) this.executionLog.shift();

      this.events.emit('controlplane:automation_executed', 'APCP.AutomationEngine', execResult);
    }
  }

  private matchesConfig(config: Record<string, unknown>, payload: unknown): boolean {
    if (!config || Object.keys(config).length === 0) return true;
    if (!payload || typeof payload !== 'object') return true;
    // Simple shallow key match
    for (const [key, value] of Object.entries(config)) {
      if ((payload as Record<string, unknown>)[key] !== value) return false;
    }
    return true;
  }

  private mapToControlAction(type: string, config: Record<string, unknown>): ControlAction | null {
    switch (type) {
      case 'restart_module':
        return { type: 'restart_module', module_key: String(config.module_key ?? '') };
      case 'deactivate_module':
        return { type: 'deactivate_module', module_key: String(config.module_key ?? '') };
      case 'enable_feature':
        return { type: 'toggle_feature', feature_key: String(config.feature_key ?? ''), enabled: true };
      case 'disable_feature':
        return { type: 'toggle_feature', feature_key: String(config.feature_key ?? ''), enabled: false };
      case 'log_audit':
        // Just emit event
        this.events.emit('controlplane:audit_action', 'APCP.AutomationEngine', config);
        return { type: 'force_health_check' };
      default:
        return null;
    }
  }
}
