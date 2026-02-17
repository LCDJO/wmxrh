/**
 * Shared types for the Platform Cognitive Layer.
 *
 * SECURITY CONTRACT:
 * The Cognitive Layer is STRICTLY READ-ONLY. It analyses data and
 * returns suggestions but NEVER executes mutations. Every suggestion
 * MUST be explicitly confirmed by the user in the UI before any
 * change is applied. The `_readonly` and `_requires_user_confirmation`
 * metadata flags are injected by the orchestrator as a runtime guard.
 */

// ── Intents ────────────────────────────────────────────────────────
export type CognitiveIntent =
  | 'suggest-permissions'
  | 'audit-permissions'
  | 'recommend-dashboards'
  | 'suggest-shortcuts'
  | 'detect-patterns'
  | 'quick-setup'
  | 'suggest-plan-upgrade'
  // UGE-powered intents
  | 'uge-simplify-roles'
  | 'uge-remove-redundant-permissions';

// ── Suggestion ─────────────────────────────────────────────────────
export type SuggestionType = 'permission' | 'dashboard' | 'shortcut' | 'pattern' | 'setup' | 'plan-upgrade' | 'role-simplification' | 'redundant-permission';

export interface CognitiveSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  confidence: number;
  action_label?: string;
  metadata?: Record<string, unknown>;
}

export interface CognitiveResponse {
  suggestions: CognitiveSuggestion[];
  summary: string;
}

// ── Context (collected by CognitiveContextCollector) ───────────────
export interface PlatformSnapshot {
  tenants: { id: string; name: string; status: string; created_at: string }[];
  users: { id: string; email: string; role: string; status: string }[];
  permissions: { id: string; code: string; module: string; description: string | null }[];
  role_permissions: { id: string; role: string; permission_id: string }[];
  modules_available: string[];
}

// ── Advisor request/response ───────────────────────────────────────
export interface AdvisorRequest {
  intent: CognitiveIntent;
  snapshot: PlatformSnapshot;
  caller: { role: string; email: string };
  params?: Record<string, unknown>;
}

export interface AdvisorPayload {
  intent: CognitiveIntent;
  system_prompt: string;
  user_prompt: string;
  snapshot_summary: Record<string, unknown>;
}

// ── Behavior event ─────────────────────────────────────────────────
export interface BehaviorEvent {
  action: string;
  route: string;
  timestamp: number;
}

export interface BehaviorProfile {
  top_routes: { route: string; visits: number }[];
  session_count: number;
  avg_session_minutes: number;
  most_used_features: string[];
}

// ── Role suggestion (from BehaviorAnalyzer pattern detection) ──────
export interface RoleSuggestionMatch {
  role: string;
  label: string;
  description: string;
  confidence: number;
  matched_signals: string[];
  event_count: number;
}
