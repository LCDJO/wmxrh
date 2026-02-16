/**
 * Shared types for the Platform Cognitive Layer.
 */

// ── Intents ────────────────────────────────────────────────────────
export type CognitiveIntent =
  | 'suggest-permissions'
  | 'recommend-dashboards'
  | 'suggest-shortcuts'
  | 'detect-patterns'
  | 'quick-setup';

// ── Suggestion ─────────────────────────────────────────────────────
export type SuggestionType = 'permission' | 'dashboard' | 'shortcut' | 'pattern' | 'setup';

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
