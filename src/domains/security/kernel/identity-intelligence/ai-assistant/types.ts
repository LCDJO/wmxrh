/**
 * AI Identity Assistant — Future: intelligent context navigation
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AI IDENTITY ASSISTANT                                          ║
 * ║                                                                  ║
 * ║  Uses LLM to understand user intent and suggest:                ║
 * ║    - Which workspace/tenant to switch to                        ║
 * ║    - Optimal scope (group/company) for the current task         ║
 * ║    - Permission elevation when needed                           ║
 * ║    - Context-aware navigation shortcuts                         ║
 * ║                                                                  ║
 * ║  Input signals:                                                  ║
 * ║    - Natural language query ("show me Org B payroll")            ║
 * ║    - Recent navigation patterns                                 ║
 * ║    - Current scope + permissions                                ║
 * ║    - Time-of-day / usage patterns                               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { ScopeType, TenantRole } from '@/domains/shared/types';

// ════════════════════════════════════
// ASSISTANT QUERY & RESPONSE
// ════════════════════════════════════

export type AssistantIntentType =
  | 'switch_workspace'
  | 'change_scope'
  | 'navigate'
  | 'explain_permissions'
  | 'suggest_action'
  | 'search_entity'
  | 'unknown';

export interface AssistantQuery {
  /** Natural language input from the user */
  readonly text: string;

  /** Current context for grounding */
  readonly current_tenant_id: string | null;
  readonly current_scope: ScopeType | null;
  readonly current_path: string;

  /** Available options for the assistant to suggest */
  readonly available_tenant_ids: readonly string[];
  readonly user_roles: readonly TenantRole[];
}

export interface AssistantSuggestion {
  readonly id: string;
  readonly intent: AssistantIntentType;
  readonly confidence: number; // 0-1

  /** Human-readable label */
  readonly label: string;

  /** Human-readable explanation */
  readonly explanation: string;

  /** Action payload — depends on intent */
  readonly action: AssistantAction;

  /** Icon hint for UI rendering */
  readonly icon_hint: string;
}

export type AssistantAction =
  | { type: 'switch_workspace'; tenant_id: string; tenant_name: string }
  | { type: 'change_scope'; scope_level: ScopeType; group_id?: string; company_id?: string }
  | { type: 'navigate'; path: string }
  | { type: 'explain'; topic: string; detail: string }
  | { type: 'search'; entity_type: string; query: string }
  | { type: 'noop'; reason: string };

export interface AssistantResponse {
  readonly query_id: string;
  readonly suggestions: readonly AssistantSuggestion[];
  readonly processing_time_ms: number;
  readonly model_used: string;
  readonly fallback_used: boolean;
}

// ════════════════════════════════════
// CONTEXT SIGNAL (fed to the LLM)
// ════════════════════════════════════

export interface ContextSignal {
  /** Recent pages visited (last 10) */
  readonly recent_paths: readonly string[];

  /** Frequently used tenants (ordered by usage) */
  readonly frequent_tenants: readonly {
    tenant_id: string;
    tenant_name: string;
    visit_count: number;
  }[];

  /** Time context */
  readonly local_hour: number;
  readonly day_of_week: number;

  /** Active alerts/notifications */
  readonly pending_alert_count: number;
  readonly pending_alert_tenants: readonly string[];
}

// ════════════════════════════════════
// ASSISTANT EVENTS
// ════════════════════════════════════

export type AssistantEventType =
  | 'QuerySubmitted'
  | 'SuggestionsReturned'
  | 'SuggestionAccepted'
  | 'SuggestionDismissed'
  | 'AssistantError';

export interface AssistantEvent {
  readonly type: AssistantEventType;
  readonly timestamp: number;
  readonly query_id: string;
  readonly metadata?: Record<string, unknown>;
}
