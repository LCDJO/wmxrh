/**
 * PermissionAdvisor
 *
 * Builds prompts for the AI to suggest ideal permissions for a given
 * role, based on current permission patterns across all roles.
 *
 * SECURITY: This class is PURE — it only builds prompt strings.
 * It has NO write access to the database and CANNOT modify
 * permissions, roles, or any other entity. All suggestions
 * returned by the AI MUST be confirmed by the user in the UI
 * before any mutation occurs.
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

  /**
   * Builds an AI prompt to audit all roles for excessive or rarely-used permissions.
   */
  buildAudit(snapshot: PlatformSnapshot, callerRole: string): AdvisorPayload {
    const existingBindings = snapshot.role_permissions.reduce<Record<string, string[]>>((acc, rp) => {
      (acc[rp.role] ??= []).push(rp.permission_id);
      return acc;
    }, {});

    const permMap = Object.fromEntries(snapshot.permissions.map(p => [p.id, p]));

    const matrix = Object.entries(existingBindings).map(([role, ids]) => ({
      role,
      count: ids.length,
      permissions: ids.map(id => permMap[id]?.code ?? id),
    }));

    // Compute usage frequency per permission
    const usageCount: Record<string, number> = {};
    snapshot.role_permissions.forEach(rp => {
      const code = permMap[rp.permission_id]?.code ?? rp.permission_id;
      usageCount[code] = (usageCount[code] ?? 0) + 1;
    });

    const totalRoles = Object.keys(existingBindings).length;
    const rarelyUsed = Object.entries(usageCount)
      .filter(([, count]) => count / (totalRoles || 1) < 0.2)
      .map(([code]) => code);

    return {
      intent: 'audit-permissions',
      system_prompt: `You are the Permission Auditor of "RH Gestão" SaaS platform.
Analyse the permission matrix and identify:
1. Roles with EXCESSIVE permissions (>80% of catalogue or sensitive combos like salary+delete+iam)
2. RARELY USED permissions (assigned to <20% of roles)
3. Security risks (roles with both financial and IAM write access)
4. Optimisation opportunities (redundant assignments, overly broad access)
Rules:
- Respond in pt-BR. Max 8 findings.
- Each finding must have type "pattern".
- Confidence: 0.0–1.0 based on severity.
- Be specific about which role and which permission is problematic.
Caller role: ${callerRole}`,
      user_prompt: `Permission catalogue: ${snapshot.permissions.length} permissions
Roles configured: ${totalRoles}

Matrix:
${JSON.stringify(matrix, null, 2)}

Rarely used permissions (<20% adoption): ${rarelyUsed.join(', ') || 'none'}

Audit the permission assignments. Identify excessive access, rarely-used permissions, and security risks.`,
      snapshot_summary: {
        total_permissions: snapshot.permissions.length,
        roles_configured: totalRoles,
        rarely_used_count: rarelyUsed.length,
      },
    };
  }
}
