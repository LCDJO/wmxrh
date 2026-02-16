/**
 * RoleSuggestionEngine
 *
 * Builds prompts for pattern detection and quick-setup guidance.
 *
 * SECURITY: This class is PURE — it only builds prompt strings.
 * It NEVER writes to the database or modifies any entity.
 * All suggestions require explicit user confirmation.
 */
import type { AdvisorPayload, PlatformSnapshot } from './types';

export class RoleSuggestionEngine {
  buildPatternDetection(snapshot: PlatformSnapshot, callerRole: string): AdvisorPayload {
    const roleDistribution = snapshot.users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});

    const tenantsByStatus = snapshot.tenants.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      intent: 'detect-patterns',
      system_prompt: `You are the Pattern Detection engine of "RH Gestão" SaaS platform.
Analyse operational data and identify:
- Anomalies (e.g. roles with no permissions, inactive tenants)
- Optimisation opportunities
- Security concerns (over-permissioned roles, orphan users)
Respond in pt-BR. Max 6 findings. Be specific.
Caller role: ${callerRole}`,
      user_prompt: `Platform snapshot:
- Tenants: ${snapshot.tenants.length} (${JSON.stringify(tenantsByStatus)})
- Users: ${snapshot.users.length} (${JSON.stringify(roleDistribution)})
- Permissions catalogue: ${snapshot.permissions.length}
- Role-permission bindings: ${snapshot.role_permissions.length}

Tenants detail: ${JSON.stringify(snapshot.tenants.slice(0, 20))}
Users detail: ${JSON.stringify(snapshot.users.slice(0, 30))}

Detect patterns, anomalies and optimisation opportunities.`,
      snapshot_summary: {
        tenants_by_status: tenantsByStatus,
        role_distribution: roleDistribution,
        binding_count: snapshot.role_permissions.length,
      },
    };
  }

  buildQuickSetup(snapshot: PlatformSnapshot, callerRole: string): AdvisorPayload {
    const configuredRoles = new Set(snapshot.role_permissions.map(rp => rp.role));
    const unconfiguredRoles = ['platform_operations', 'platform_support', 'platform_finance', 'platform_read_only']
      .filter(r => !configuredRoles.has(r));

    return {
      intent: 'quick-setup',
      system_prompt: `You are the Setup Advisor of "RH Gestão" SaaS platform.
Guide the admin through the optimal configuration steps.
Prioritise: security, then operational efficiency, then convenience.
Respond in pt-BR. Max 6 steps. Be actionable.
Caller role: ${callerRole}`,
      user_prompt: `Current state:
- Tenants created: ${snapshot.tenants.length}
- Users: ${snapshot.users.length}
- Permissions configured: ${snapshot.role_permissions.length}
- Roles without permissions: ${unconfiguredRoles.join(', ') || 'none'}

What should the admin configure next for an optimal platform setup?`,
      snapshot_summary: {
        unconfigured_roles: unconfiguredRoles,
        tenants: snapshot.tenants.length,
        users: snapshot.users.length,
      },
    };
  }
}
