/**
 * CognitiveInsightsService — Orchestrator
 *
 * Coordinates the full cognitive pipeline:
 *  1. CognitiveContextCollector  → gathers snapshot
 *  2. BehaviorAnalyzer           → builds behaviour profile
 *  3. Advisor (Permission / Navigation / RoleSuggestion) → builds prompt payload
 *  4. Edge function call         → sends payload to AI
 *  5. Returns structured CognitiveResponse
 */
import { supabase } from '@/integrations/supabase/client';
import { CognitiveContextCollector } from './cognitive-context-collector';
import { BehaviorAnalyzer } from './behavior-analyzer';
import { PermissionAdvisor } from './permission-advisor';
import { NavigationAdvisor } from './navigation-advisor';
import { RoleSuggestionEngine } from './role-suggestion-engine';
import type { CognitiveIntent, CognitiveResponse, AdvisorPayload } from './types';

export class CognitiveInsightsService {
  private collector = new CognitiveContextCollector();
  private behavior = new BehaviorAnalyzer();
  private permAdvisor = new PermissionAdvisor();
  private navAdvisor = new NavigationAdvisor();
  private roleEngine = new RoleSuggestionEngine();

  // ── Public API ───────────────────────────────────────────────────

  /** Track a navigation event (call from layout on route change). */
  trackNavigation(route: string) {
    this.behavior.track('navigate', route);
  }

  /** Main entry point — orchestrates the full pipeline. */
  async query(
    intent: CognitiveIntent,
    caller: { role: string; email: string },
    params?: Record<string, unknown>,
  ): Promise<CognitiveResponse> {
    // 1. Collect
    const snapshot = await this.collector.collect();

    // 2. Build advisor payload
    const payload = this.routeToAdvisor(intent, caller.role, params);

    // 3. Call edge function
    const { data, error } = await supabase.functions.invoke('platform-cognitive', {
      body: {
        intent,
        advisor_payload: payload,
        context: params,
      },
    });

    if (error) {
      const msg = typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
      throw new Error(msg);
    }

    if (data?.error) throw new Error(data.error);

    return data as CognitiveResponse;
  }

  /** Force-refresh the cached snapshot. */
  refreshContext() {
    this.collector.invalidate();
  }

  /** Get current behaviour profile (for display/debug). */
  getBehaviorProfile() {
    return this.behavior.profile();
  }

  // ── Private ──────────────────────────────────────────────────────

  private routeToAdvisor(intent: CognitiveIntent, callerRole: string, params?: Record<string, unknown>): AdvisorPayload | null {
    // We need the snapshot synchronously here — it was already cached by collect()
    const snapshot = (this.collector as any).cache;
    if (!snapshot) return null;

    const profile = this.behavior.profile();

    switch (intent) {
      case 'suggest-permissions':
        return this.permAdvisor.build(snapshot, callerRole, params?.role_name as string | undefined);
      case 'recommend-dashboards':
        return this.navAdvisor.buildDashboards(snapshot, callerRole, profile);
      case 'suggest-shortcuts':
        return this.navAdvisor.buildShortcuts(snapshot, callerRole, profile);
      case 'detect-patterns':
        return this.roleEngine.buildPatternDetection(snapshot, callerRole);
      case 'quick-setup':
        return this.roleEngine.buildQuickSetup(snapshot, callerRole);
      default:
        return null;
    }
  }
}
