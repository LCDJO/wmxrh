/**
 * Safety Automation Engine — Rule Engine
 *
 * Evaluates incoming SafetySignals against registered automation rules.
 * Uses a priority-sorted rule set with cooldown enforcement.
 */

import type {
  SafetySignal,
  SafetyAutomationRule,
  SafetyRuleCondition,
  SafetySignalSeverity,
} from './types';

// ═══════════════════════════════════════════════════════
// SEVERITY RANKING (for min_severity comparison)
// ═══════════════════════════════════════════════════════

const SEVERITY_RANK: Record<SafetySignalSeverity, number> = {
  informational: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ═══════════════════════════════════════════════════════
// COOLDOWN TRACKER (in-memory per tenant+rule+entity)
// ═══════════════════════════════════════════════════════

const cooldownMap = new Map<string, number>(); // key → timestamp

function cooldownKey(ruleId: string, entityId: string): string {
  return `${ruleId}::${entityId}`;
}

function isInCooldown(ruleId: string, entityId: string, cooldownHours: number): boolean {
  if (cooldownHours <= 0) return false;
  const key = cooldownKey(ruleId, entityId);
  const lastTriggered = cooldownMap.get(key);
  if (!lastTriggered) return false;
  return Date.now() - lastTriggered < cooldownHours * 3600_000;
}

function setCooldown(ruleId: string, entityId: string): void {
  cooldownMap.set(cooldownKey(ruleId, entityId), Date.now());
}

// ═══════════════════════════════════════════════════════
// CONDITION EVALUATOR
// ═══════════════════════════════════════════════════════

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateCondition(condition: SafetyRuleCondition, signal: SafetySignal): boolean {
  const value = getNestedValue(signal as unknown as Record<string, unknown>, condition.field);

  switch (condition.operator) {
    case 'eq': return value === condition.value;
    case 'neq': return value !== condition.value;
    case 'gt': return typeof value === 'number' && value > (condition.value as number);
    case 'gte': return typeof value === 'number' && value >= (condition.value as number);
    case 'lt': return typeof value === 'number' && value < (condition.value as number);
    case 'lte': return typeof value === 'number' && value <= (condition.value as number);
    case 'in': return Array.isArray(condition.value) && (condition.value as unknown[]).includes(value);
    case 'contains': return typeof value === 'string' && typeof condition.value === 'string' && value.includes(condition.value);
    default: return false;
  }
}

// ═══════════════════════════════════════════════════════
// RULE MATCHING
// ═══════════════════════════════════════════════════════

export interface RuleMatchResult {
  rule: SafetyAutomationRule;
  matched: boolean;
  skip_reason?: string;
}

/**
 * Match a signal against all active rules, returning the first matching rule
 * (sorted by priority, with cooldown enforcement).
 */
export function matchSignalToRules(
  signal: SafetySignal,
  rules: SafetyAutomationRule[],
): RuleMatchResult | null {
  // Sort by priority (lower number = higher priority)
  const sorted = [...rules]
    .filter(r => r.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    // 1. Check trigger source
    if (!rule.trigger_sources.includes(signal.source)) continue;

    // 2. Check minimum severity
    if (SEVERITY_RANK[signal.severity] < SEVERITY_RANK[rule.min_severity]) continue;

    // 3. Check cooldown
    if (isInCooldown(rule.id, signal.entity_id, rule.cooldown_hours)) continue;

    // 4. Evaluate all conditions (AND logic)
    const allConditionsMet = rule.conditions.every(cond => evaluateCondition(cond, signal));
    if (!allConditionsMet) continue;

    // Match found — set cooldown and return
    setCooldown(rule.id, signal.entity_id);
    return { rule, matched: true };
  }

  return null;
}

/**
 * Evaluate all rules against a signal (for audit/debugging).
 * Returns results for every rule, including skip reasons.
 */
export function evaluateAllRules(
  signal: SafetySignal,
  rules: SafetyAutomationRule[],
): RuleMatchResult[] {
  return rules.map(rule => {
    if (rule.status !== 'active') {
      return { rule, matched: false, skip_reason: 'Rule is not active' };
    }
    if (!rule.trigger_sources.includes(signal.source)) {
      return { rule, matched: false, skip_reason: `Source '${signal.source}' not in trigger_sources` };
    }
    if (SEVERITY_RANK[signal.severity] < SEVERITY_RANK[rule.min_severity]) {
      return { rule, matched: false, skip_reason: `Severity '${signal.severity}' below minimum '${rule.min_severity}'` };
    }
    if (isInCooldown(rule.id, signal.entity_id, rule.cooldown_hours)) {
      return { rule, matched: false, skip_reason: 'Rule in cooldown for this entity' };
    }
    const failedCondition = rule.conditions.find(c => !evaluateCondition(c, signal));
    if (failedCondition) {
      return { rule, matched: false, skip_reason: `Condition failed: ${failedCondition.field} ${failedCondition.operator} ${JSON.stringify(failedCondition.value)}` };
    }
    return { rule, matched: true };
  });
}

/** Reset cooldowns (useful for testing) */
export function resetCooldowns(): void {
  cooldownMap.clear();
}
