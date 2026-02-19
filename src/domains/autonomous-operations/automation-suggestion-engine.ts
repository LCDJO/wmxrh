/**
 * AutomationSuggestionEngine — Generates actionable automation suggestions from detected patterns.
 */

import type { BehaviorPattern, AutomationSuggestion, SuggestedAction, SuggestionPriority } from './types';

let _sugSeq = 0;

function priorityFromPattern(pattern: BehaviorPattern): SuggestionPriority {
  if (pattern.confidence >= 80 && (pattern.type === 'error_burst' || pattern.type === 'security_anomaly')) return 'critical';
  if (pattern.confidence >= 60) return 'high';
  if (pattern.confidence >= 40) return 'medium';
  return 'low';
}

function generateActions(pattern: BehaviorPattern): SuggestedAction[] {
  switch (pattern.type) {
    case 'error_burst':
      return [
        { type: 'alert', target: 'platform_ops', parameters: { message: `Rajada de erros: ${pattern.description}` } },
        { type: 'heal', target: pattern.affected_modules[0] || 'unknown', parameters: { action: 'restart_module' } },
      ];
    case 'usage_spike':
      return [
        { type: 'notify', target: 'platform_ops', parameters: { message: `Pico de uso: ${pattern.description}` } },
        { type: 'scale', target: pattern.affected_modules[0] || 'unknown', parameters: { direction: 'up' } },
      ];
    case 'security_anomaly':
      return [
        { type: 'alert', target: 'security_team', parameters: { message: pattern.description } },
        { type: 'throttle', target: 'identity', parameters: { rate_limit: 'strict' } },
      ];
    case 'churn_risk':
      return [
        { type: 'recommend', target: 'customer_success', parameters: { action: 'engagement_campaign' } },
        { type: 'notify', target: 'revenue_team', parameters: { message: pattern.description } },
      ];
    case 'growth_opportunity':
      return [
        { type: 'recommend', target: 'growth_team', parameters: { action: 'upsell_campaign' } },
      ];
    default:
      return [
        { type: 'notify', target: 'platform_ops', parameters: { message: pattern.description } },
      ];
  }
}

export const AutomationSuggestionEngine = {
  /** Generate suggestions from detected patterns */
  generate(patterns: BehaviorPattern[]): AutomationSuggestion[] {
    return patterns.map(pattern => ({
      id: `sug_${++_sugSeq}_${Date.now()}`,
      title: `Auto-ação: ${pattern.type.replace(/_/g, ' ')}`,
      description: pattern.description,
      priority: priorityFromPattern(pattern),
      status: 'pending' as const,
      trigger_pattern_id: pattern.id,
      estimated_impact: pattern.confidence >= 70 ? 'Alto — redução imediata de risco' : 'Médio — otimização preventiva',
      actions: generateActions(pattern),
      created_at: new Date().toISOString(),
    }));
  },
};
