/**
 * CognitiveInsightsService — Orchestrator
 *
 * Pipeline: Collect → Analyze → Advise → AI → Response
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT                                              ║
 * ║  This service is READ-ONLY. It NEVER modifies permissions,      ║
 * ║  roles, users, or any database state. It only:                  ║
 * ║    1. Reads snapshot data (via CognitiveContextCollector)        ║
 * ║    2. Builds AI prompts (via Advisors)                          ║
 * ║    3. Returns suggestions (CognitiveResponse)                   ║
 * ║  All mutations MUST happen in the calling UI component          ║
 * ║  AFTER explicit user confirmation.                              ║
 * ╚══════════════════════════════════════════════════════════════════╝
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
  private behavior: BehaviorAnalyzer;
  private permAdvisor = new PermissionAdvisor();
  private navAdvisor = new NavigationAdvisor();
  private roleEngine = new RoleSuggestionEngine();

  constructor() {
    this.behavior = new BehaviorAnalyzer(this.collector);
  }

  // ── Public API ───────────────────────────────────────────────────

  trackNavigation(route: string) {
    this.behavior.track('navigate', route);
  }

  trackModuleUse(moduleKey: string) {
    this.collector.trackModuleUse(moduleKey);
  }

  trackCommand(command: string, meta?: Record<string, unknown>) {
    this.collector.trackCommand(command, meta);
  }

  /**
   * Query the cognitive layer for suggestions.
   *
   * SECURITY: This method is READ-ONLY. It returns suggestions but
   * NEVER applies them. The caller MUST present suggestions to the
   * user and require explicit confirmation before any mutation.
   */
  async query(
    intent: CognitiveIntent,
    caller: { role: string; email: string },
    params?: Record<string, unknown>,
  ): Promise<CognitiveResponse> {
    // 1. Collect snapshot (read-only)
    const snapshot = await this.collector.collect();

    // 2. Build advisor payload (read-only prompt generation)
    const payload = await this.routeToAdvisor(intent, caller.role, params);

    // 3. Call edge function (read-only — returns suggestions only)
    // PRIVACY: anonymise caller before sending to AI
    const anonymisedCaller = {
      role: caller.role,
      // Never send real email to AI — use opaque identifier
      email: `user_${btoa(caller.email).slice(0, 8)}`,
    };

    const { data, error } = await supabase.functions.invoke('platform-cognitive', {
      body: {
        intent,
        advisor_payload: payload,
        context: this.stripPiiFromContext(params),
        caller: anonymisedCaller,
      },
    });

    if (error) {
      const msg = typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);

    const response = data as CognitiveResponse;

    // SECURITY GUARD: Strip any mutation payloads that AI might hallucinate
    response.suggestions = response.suggestions.map(s => ({
      ...s,
      metadata: {
        ...s.metadata,
        _readonly: true,
        _requires_user_confirmation: true,
      },
    }));

    return response;
  }

  refreshContext() { this.collector.invalidate(); }

  getBehaviorProfile() { return this.behavior.sessionProfile(); }

  async getFullBehaviorProfile() { return this.behavior.fullProfile(); }

  async getEventStats(daysBack = 30) { return this.collector.getEventStats(daysBack); }

  // ── Private ──────────────────────────────────────────────────────

  private async routeToAdvisor(intent: CognitiveIntent, callerRole: string, params?: Record<string, unknown>): Promise<AdvisorPayload | null> {
    const snapshot = (this.collector as any).snapshotCache;
    if (!snapshot) return null;

    // PRIVACY: anonymise emails in snapshot before advisor processing
    const anonSnapshot = {
      ...snapshot,
      users: snapshot.users.map((u: any) => ({
        ...u,
        email: `user_${btoa(u.email || '').slice(0, 8)}`,
      })),
    };

    const profile = await this.behavior.fullProfile();

    switch (intent) {
      case 'suggest-permissions':
        return this.permAdvisor.build(anonSnapshot, callerRole, params?.role_name as string | undefined);
      case 'audit-permissions':
        return this.permAdvisor.buildAudit(anonSnapshot, callerRole);
      case 'recommend-dashboards':
        return this.navAdvisor.buildDashboards(anonSnapshot, callerRole, profile);
      case 'suggest-shortcuts':
        return this.navAdvisor.buildShortcuts(anonSnapshot, callerRole, profile);
      case 'detect-patterns':
        return this.roleEngine.buildPatternDetection(anonSnapshot, callerRole);
      case 'quick-setup':
        return this.roleEngine.buildQuickSetup(anonSnapshot, callerRole);
      default:
        return null;
    }
  }

  /**
   * Strip PII from context params before sending to AI.
   */
  private stripPiiFromContext(params?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!params) return undefined;
    const PII_KEYS = /email|cpf|cnpj|phone|telefone|name|nome|address|endereco|birth|nascimento/i;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (PII_KEYS.test(k)) continue;
      if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) continue;
      clean[k] = v;
    }
    return clean;
  }
}
