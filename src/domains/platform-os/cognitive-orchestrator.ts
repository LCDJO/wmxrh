/**
 * CognitiveOrchestrator — Bridges the Cognitive Layer into the POSL.
 *
 * Receives signals from:
 *   • BehaviorAnalyzer    → layout & shortcut suggestions
 *   • PermissionAdvisor   → permission & role suggestions
 *   • NavigationAdvisor   → dashboard & shortcut suggestions
 *   • RoleSuggestionEngine → pattern detection & quick-setup
 *
 * Exposes a unified signal queue that the UI can consume.
 *
 * SECURITY: READ-ONLY. Signals require explicit user confirmation
 * (acceptSignal) before any mutation occurs. The orchestrator emits
 * events but NEVER executes mutations itself.
 */

import type {
  CognitiveOrchestratorAPI,
  CognitiveState,
  CognitiveSignal,
  CognitiveSignalKind,
  GlobalEventKernelAPI,
} from './types';
import { CognitiveInsightsService } from '@/domains/platform-cognitive/cognitive-insights.service';
import type { CognitiveSuggestion, SuggestionType } from '@/domains/platform-cognitive/types';

const MAX_SIGNALS = 50;

let signalCounter = 0;
function nextSignalId(): string {
  return `cog-${Date.now().toString(36)}-${(++signalCounter).toString(36)}`;
}

// ── Map CognitiveLayer types → POSL signal kinds ────────────────

const SUGGESTION_KIND_MAP: Record<SuggestionType, CognitiveSignalKind> = {
  permission: 'permission_suggestion',
  dashboard: 'dashboard_recommendation',
  shortcut: 'shortcut_suggestion',
  pattern: 'pattern_detection',
  setup: 'quick_setup',
  'plan-upgrade': 'dashboard_recommendation',
};

function mapSuggestionToSignal(
  s: CognitiveSuggestion,
  source: CognitiveSignal['source'],
): Omit<CognitiveSignal, 'id' | 'dismissed' | 'accepted' | 'created_at'> {
  return {
    kind: SUGGESTION_KIND_MAP[s.type] ?? 'pattern_detection',
    title: s.title,
    description: s.description,
    confidence: s.confidence,
    source,
    action_label: s.action_label,
    expires_at: Date.now() + 30 * 60 * 1000, // 30 min TTL
    metadata: s.metadata,
  };
}

// ════════════════════════════════════════════════════════════════
// Factory
// ════════════════════════════════════════════════════════════════

export function createCognitiveOrchestrator(
  events: GlobalEventKernelAPI,
  cognitiveService: CognitiveInsightsService,
): CognitiveOrchestratorAPI {
  const signals: CognitiveSignal[] = [];
  let lastQueryAt: number | null = null;

  // ── Event bridges ─────────────────────────────────────────

  events.on('navigation:navigated', (event) => {
    const path = (event.payload as any)?.path;
    if (path) cognitiveService.trackNavigation(path);
  });

  events.on('module:activated', (event) => {
    const key = (event.payload as any)?.key;
    if (key) cognitiveService.trackModuleUse(key);
  });

  // ── Signal management ─────────────────────────────────────

  function pushSignal(
    input: Omit<CognitiveSignal, 'id' | 'dismissed' | 'accepted' | 'created_at'>,
  ): string {
    const id = nextSignalId();
    const signal: CognitiveSignal = {
      ...input,
      id,
      dismissed: false,
      accepted: false,
      created_at: Date.now(),
    };

    signals.push(signal);

    // Cap the queue
    if (signals.length > MAX_SIGNALS) {
      signals.splice(0, signals.length - MAX_SIGNALS);
    }

    events.emit('cognitive:signal_pushed', 'CognitiveOrchestrator', {
      signalId: id,
      kind: signal.kind,
      confidence: signal.confidence,
    });

    return id;
  }

  function activeSignals(filter?: { kind?: CognitiveSignalKind; minConfidence?: number }): CognitiveSignal[] {
    const now = Date.now();
    return signals.filter(s => {
      if (s.dismissed || s.accepted) return false;
      if (s.expires_at && s.expires_at < now) return false;
      if (filter?.kind && s.kind !== filter.kind) return false;
      if (filter?.minConfidence && s.confidence < filter.minConfidence) return false;
      return true;
    });
  }

  function dismissSignal(signalId: string): void {
    const s = signals.find(sig => sig.id === signalId);
    if (s) {
      s.dismissed = true;
      events.emit('cognitive:signal_dismissed', 'CognitiveOrchestrator', { signalId, kind: s.kind });
    }
  }

  function acceptSignal(signalId: string): void {
    const s = signals.find(sig => sig.id === signalId);
    if (s) {
      s.accepted = true;
      events.emit('cognitive:signal_accepted', 'CognitiveOrchestrator', {
        signalId,
        kind: s.kind,
        title: s.title,
        metadata: s.metadata,
      });
    }
  }

  function clearSignals(): void {
    signals.length = 0;
    events.emit('cognitive:signals_cleared', 'CognitiveOrchestrator', {});
  }

  // ── Query helpers (delegate to CognitiveInsightsService) ──

  async function queryAndPushSignals(
    intent: 'recommend-dashboards' | 'suggest-permissions' | 'suggest-shortcuts',
    caller: { role: string; email: string },
    source: CognitiveSignal['source'],
    params?: Record<string, unknown>,
  ): Promise<CognitiveSignal[]> {
    lastQueryAt = Date.now();
    const response = await cognitiveService.query(intent, caller, params);
    const pushed: CognitiveSignal[] = [];

    for (const suggestion of response.suggestions) {
      const input = mapSuggestionToSignal(suggestion, source);
      const id = pushSignal(input);
      const created = signals.find(s => s.id === id);
      if (created) pushed.push(created);
    }

    return pushed;
  }

  async function suggestLayout(caller: { role: string; email: string }): Promise<CognitiveSignal[]> {
    return queryAndPushSignals('recommend-dashboards', caller, 'navigation_advisor');
  }

  async function suggestPermissions(
    caller: { role: string; email: string },
    targetRole?: string,
  ): Promise<CognitiveSignal[]> {
    return queryAndPushSignals('suggest-permissions', caller, 'permission_advisor', {
      role_name: targetRole,
    });
  }

  async function suggestShortcuts(caller: { role: string; email: string }): Promise<CognitiveSignal[]> {
    return queryAndPushSignals('suggest-shortcuts', caller, 'navigation_advisor');
  }

  // ── State ─────────────────────────────────────────────────

  function state(): CognitiveState {
    const profile = cognitiveService.getBehaviorProfile();
    const active = activeSignals();
    const byKind: Partial<Record<CognitiveSignalKind, number>> = {};
    for (const s of active) {
      byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    }

    return {
      is_active: true,
      last_query_at: lastQueryAt,
      pending_suggestions: active.length,
      active_signals: active.length,
      behavior_session_count: profile?.session_count ?? 0,
      signals_by_kind: byKind,
    };
  }

  function trackNavigation(route: string, userId?: string): void {
    cognitiveService.trackNavigation(route, userId);
  }

  function trackModuleUse(moduleKey: string): void {
    cognitiveService.trackModuleUse(moduleKey);
  }

  function isActive(): boolean {
    return true;
  }

  return {
    state,
    trackNavigation,
    trackModuleUse,
    isActive,
    pushSignal,
    activeSignals,
    dismissSignal,
    acceptSignal,
    clearSignals,
    suggestLayout,
    suggestPermissions,
    suggestShortcuts,
  };
}
