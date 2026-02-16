/**
 * PermissionAdvisor
 *
 * Builds prompts for the AI to suggest ideal permissions for a given
 * role, based on current permission patterns across all roles.
 */
import type { AdvisorPayload, PlatformSnapshot } from './types';

export class PermissionAdvisor {
  build(snapshot: PlatformSnapshot, callerRole: string, targetRole?: string): AdvisorPayload {
    const existingBindings = snapshot.role_permissions.reduce<Record<string, string[]>>((acc, rp) => {
      (acc[rp.role] ??= []).push(rp.permission_id);
      return acc;
    }, {});

    const permMap = Object.fromEntries(snapshot.permissions.map(p => [p.id, p]));

    // Build a human-readable matrix
    const matrix = Object.entries(existingBindings).map(([role, ids]) => ({
      role,
      permissions: ids.map(id => permMap[id]?.code ?? id),
    }));

    return {
      intent: 'suggest-permissions',
      system_prompt: `You are the Permission Advisor of "RH Gestão" SaaS platform.
Analyse the existing permission matrix and suggest the ideal set for the target role.
Rules:
- Suggest ONLY from the available permission catalogue.
- Consider least-privilege principle.
- Explain WHY each permission is recommended.
- Respond in pt-BR.
- Confidence: 0.0–1.0.
- IMPORTANT: Each suggestion title MUST be the permission code (e.g. "employee.view").
- Each suggestion MUST include metadata.permission_code with the exact code string.
- Type must be "permission".
Caller role: ${callerRole}`,
      user_prompt: `Target role: "${targetRole ?? 'new role'}"

Available permissions (${snapshot.permissions.length}):
${snapshot.permissions.map(p => `• ${p.code} (${p.module}) — ${p.description ?? ''}`).join('\n')}

Current matrix:
${JSON.stringify(matrix, null, 2)}

Suggest the ideal permissions for "${targetRole ?? 'new role'}". Return each as type "permission" with metadata.permission_code set to the exact code.`,
      snapshot_summary: {
        total_permissions: snapshot.permissions.length,
        roles_configured: Object.keys(existingBindings).length,
        target_role: targetRole,
      },
    };
  }
}
