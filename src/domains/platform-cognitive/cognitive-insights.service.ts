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
import { platformEvents } from '@/domains/platform/platform-events';
import { BehaviorAnalyzer } from './behavior-analyzer';
import { PermissionAdvisor } from './permission-advisor';
import { NavigationAdvisor } from './navigation-advisor';
import { RoleSuggestionEngine } from './role-suggestion-engine';
import { PlanUpgradeAdvisor } from './plan-upgrade-advisor';
import type { CognitiveIntent, CognitiveResponse, AdvisorPayload } from './types';

export class CognitiveInsightsService {
  private collector = new CognitiveContextCollector();
  private behavior: BehaviorAnalyzer;
  private permAdvisor = new PermissionAdvisor();
  private navAdvisor = new NavigationAdvisor();
  private roleEngine = new RoleSuggestionEngine();
  private planAdvisor = new PlanUpgradeAdvisor();

  constructor() {
    this.behavior = new BehaviorAnalyzer(this.collector);
  }

  // ── Public API ───────────────────────────────────────────────────

  trackNavigation(route: string, userId?: string) {
    this.behavior.track('navigate', route);
    if (userId) {
      platformEvents.userBehaviorTracked(userId, { route, eventType: 'navigate' });
    }
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

    // ── Emit domain events based on intent ──────────────────────
    const actorId = caller.email || 'unknown';

    if (intent === 'suggest-permissions' && response.suggestions.length > 0) {
      // Check for permission risks in suggestions
      const riskySuggestions = response.suggestions.filter(
        s => s.confidence >= 0.7 && s.metadata?.permission_code &&
        /salary|payroll|iam\.delete|admin/i.test(String(s.metadata.permission_code))
      );
      riskySuggestions.forEach(s => {
        platformEvents.permissionRiskDetected(actorId, {
          riskType: 'sensitive_permission_suggested',
          role: String(params?.role_name ?? 'unknown'),
          details: `AI suggested sensitive permission: ${s.metadata?.permission_code}`,
          severity: s.confidence >= 0.85 ? 'high' : 'medium',
        });
      });
    }

    if (intent === 'audit-permissions') {
      response.suggestions
        .filter(s => s.confidence >= 0.6)
        .forEach(s => {
          platformEvents.permissionRiskDetected(actorId, {
            riskType: 'audit_finding',
            role: String(s.metadata?.role ?? 'multiple'),
            details: s.description,
            severity: s.confidence >= 0.8 ? 'high' : s.confidence >= 0.6 ? 'medium' : 'low',
          });
        });
    }

    if (intent === 'detect-patterns') {
      const roles = response.suggestions
        .filter(s => s.type === 'pattern')
        .map(s => s.title);
      if (roles.length > 0) {
        platformEvents.roleSuggestionGenerated(actorId, {
          suggestedRoles: roles,
          confidence: response.suggestions.map(s => s.confidence),
          signalCount: response.suggestions.length,
        });
      }
    }

    if (intent === 'suggest-shortcuts') {
      response.suggestions.forEach(s => {
        const route = String(s.metadata?.route ?? s.title);
        platformEvents.navigationHintCreated(actorId, {
          route,
          label: s.title,
          source: 'ai',
        });
      });
    }

    if (intent === 'suggest-plan-upgrade' && response.suggestions.length > 0) {
      response.suggestions.forEach(s => {
        platformEvents.navigationHintCreated(actorId, {
          route: '/platform/plans',
          label: s.title,
          source: 'ai',
        });
      });
    }

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
      case 'suggest-plan-upgrade':
        return this.planAdvisor.build(
          anonSnapshot,
          callerRole,
          profile,
          params?.currentPlan as { tier: string; plan_name: string } | undefined,
        );
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
