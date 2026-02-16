/**
 * NavigationAdvisor
 *
 * Produces prompts to recommend dashboards and navigation shortcuts
 * based on the caller's role and behaviour profile.
 */
import type { AdvisorPayload, BehaviorProfile, PlatformSnapshot } from './types';

export class NavigationAdvisor {
  buildDashboards(snapshot: PlatformSnapshot, callerRole: string, behavior: BehaviorProfile): AdvisorPayload {
    return {
      intent: 'recommend-dashboards',
      system_prompt: `You are the Navigation Advisor of "RH Gestão" SaaS platform.
Recommend the most relevant dashboards and data views for the caller.
Consider their role, behaviour and the platform's current state.
Respond in pt-BR. Max 5 suggestions.
Caller role: ${callerRole}`,
      user_prompt: `Role: ${callerRole}
Behaviour profile: ${JSON.stringify(behavior)}
Available modules: ${snapshot.modules_available.join(', ')}
Active tenants: ${snapshot.tenants.filter(t => t.status === 'active').length}
Total users: ${snapshot.users.length}

Recommend dashboards and data views.`,
      snapshot_summary: {
        active_tenants: snapshot.tenants.filter(t => t.status === 'active').length,
        total_users: snapshot.users.length,
        behavior_sessions: behavior.session_count,
      },
    };
  }

  buildShortcuts(snapshot: PlatformSnapshot, callerRole: string, behavior: BehaviorProfile): AdvisorPayload {
    return {
      intent: 'suggest-shortcuts',
      system_prompt: `You are the Navigation Advisor of "RH Gestão" SaaS platform.
Suggest quick-access shortcuts that save the caller time.
Base recommendations on their actual navigation patterns.
Respond in pt-BR. Max 5 suggestions.
Caller role: ${callerRole}`,
      user_prompt: `Role: ${callerRole}
Top routes visited: ${behavior.top_routes.map(r => `${r.route} (${r.visits}x)`).join(', ')}
Available modules: ${snapshot.modules_available.join(', ')}

Suggest navigation shortcuts and quick actions.`,
      snapshot_summary: {
        top_routes: behavior.top_routes.slice(0, 5),
      },
    };
  }
}
