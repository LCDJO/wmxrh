/**
 * Governance AI — Shared utilities.
 */

import type { RemediationAction, RemediationStep } from './types';

let _insightCounter = 0;

export function insightId(): string {
  return `gi_${++_insightCounter}_${Date.now()}`;
}

export function buildRemediation(
  type: RemediationAction['type'],
  description: string,
  impact: string,
  steps: RemediationStep[],
): RemediationAction {
  return {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    description,
    impact_summary: impact,
    steps,
    status: 'pending',
    requires_approval: true,
    created_at: Date.now(),
  };
}
