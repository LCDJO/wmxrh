/**
 * AppSecurityBoundary — Enforces that third-party apps NEVER access
 * the Security Kernel or Billing Database directly.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY MODEL                                                  ║
 * ║                                                                  ║
 * ║  Apps can ONLY interact with platform data through:              ║
 * ║    → ApiGatewayController (validated, scoped, rate-limited)      ║
 * ║                                                                  ║
 * ║  BLOCKED resources (never directly accessible):                  ║
 * ║    ✗ Security Kernel (identity, permissions, policies, audit)    ║
 * ║    ✗ Billing Database (invoices, subscriptions, revenue)         ║
 * ║    ✗ Platform Users / IAM                                        ║
 * ║    ✗ Tenant Memberships / Roles                                  ║
 * ║                                                                  ║
 * ║  If an app needs billing or security data, it must request       ║
 * ║  specific scopes and go through the API Gateway, which returns   ║
 * ║  only sanitized, tenant-scoped projections.                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Blocked resource patterns ─────────────────────────────────
const BLOCKED_RESOURCES = [
  // Security Kernel
  /^security\./i,
  /^kernel\./i,
  /^identity\./i,
  /^permission/i,
  /^policy/i,
  /^audit_log/i,
  /^access_graph/i,
  /^iam\./i,
  /^impersonat/i,

  // Billing / Finance
  /^billing\./i,
  /^invoice/i,
  /^subscription/i,
  /^revenue/i,
  /^ledger/i,
  /^payment/i,
  /^coupon/i,
  /^saas_plan/i,

  // Platform internals
  /^platform_user/i,
  /^tenant_membership/i,
  /^user_role/i,
  /^custom_role/i,
  /^role_permission/i,

  // Auth
  /^auth\./i,
  /^jwt/i,
  /^token\./i,
] as const;

// ── Allowed access patterns (via API Gateway scopes) ──────────
const ALLOWED_SCOPE_PATTERNS = [
  /^hr\./,           // HR module
  /^employee\./,     // Employee data (scoped)
  /^benefit\./,      // Benefits
  /^training\./,     // Training
  /^compliance\./,   // Compliance checks
  /^document\./,     // Document management
  /^report\./,       // Reports (read-only)
  /^webhook\./,      // Webhook subscriptions
  /^app\.\w+\.self/, // App's own data
] as const;

export type BoundaryCheckResult = {
  allowed: boolean;
  reason: string;
  resource: string;
  violated_rule?: string;
};

/**
 * Check if an app is allowed to access a given resource.
 * This is called by the ApiGatewayController before routing any request.
 */
export function checkAppResourceAccess(
  appId: string,
  resource: string,
  grantedScopes: string[],
): BoundaryCheckResult {
  // 1. Block forbidden resources regardless of scopes
  for (const pattern of BLOCKED_RESOURCES) {
    if (pattern.test(resource)) {
      return {
        allowed: false,
        reason: `Resource "${resource}" is blocked for third-party apps. Use the API Gateway with appropriate scopes.`,
        resource,
        violated_rule: pattern.source,
      };
    }
  }

  // 2. Verify the app has a scope that covers this resource
  const resourceLower = resource.toLowerCase();
  const hasMatchingScope = grantedScopes.some(scope => {
    // Exact match
    if (scope === resource || scope === resourceLower) return true;
    // Wildcard match (e.g. "hr.*" covers "hr.employee.read")
    if (scope.endsWith('.*')) {
      const prefix = scope.slice(0, -2);
      if (resourceLower.startsWith(prefix.toLowerCase())) return true;
    }
    // Module wildcard (e.g. "hr" covers "hr.anything")
    if (!scope.includes('.') && resourceLower.startsWith(scope.toLowerCase() + '.')) return true;
    return false;
  });

  if (!hasMatchingScope) {
    return {
      allowed: false,
      reason: `App "${appId}" does not have a scope granting access to "${resource}". Request the appropriate scope.`,
      resource,
    };
  }

  return { allowed: true, reason: 'ok', resource };
}

/**
 * Validate that a set of requested scopes does not include blocked resources.
 * Used when an app requests new scopes during installation or upgrade.
 */
export function validateScopeRequest(requestedScopes: string[]): {
  valid: boolean;
  rejected: Array<{ scope: string; reason: string }>;
  approved: string[];
} {
  const rejected: Array<{ scope: string; reason: string }> = [];
  const approved: string[] = [];

  for (const scope of requestedScopes) {
    let blocked = false;
    for (const pattern of BLOCKED_RESOURCES) {
      if (pattern.test(scope)) {
        rejected.push({
          scope,
          reason: `Scope "${scope}" attempts to access a restricted resource (${pattern.source}). Access to Security Kernel and Billing Database is not available to third-party apps.`,
        });
        blocked = true;
        break;
      }
    }
    if (!blocked) approved.push(scope);
  }

  return { valid: rejected.length === 0, rejected, approved };
}

/**
 * List of resource categories that are always blocked for apps.
 * Useful for documentation / developer portal display.
 */
export const BLOCKED_RESOURCE_CATEGORIES = [
  { category: 'Security Kernel', examples: ['security.*', 'identity.*', 'permission.*', 'policy.*', 'audit_log.*'] },
  { category: 'Billing & Finance', examples: ['billing.*', 'invoice.*', 'subscription.*', 'revenue.*', 'payment.*'] },
  { category: 'Platform IAM', examples: ['platform_user.*', 'user_role.*', 'tenant_membership.*', 'custom_role.*'] },
  { category: 'Authentication', examples: ['auth.*', 'jwt.*', 'token.*'] },
] as const;

/**
 * List of resource categories that apps CAN request scopes for.
 */
export const ALLOWED_RESOURCE_CATEGORIES = [
  { category: 'HR Module', pattern: 'hr.*', description: 'Access to HR data (employees, departments, positions)' },
  { category: 'Benefits', pattern: 'benefit.*', description: 'Access to benefit plans and enrollments' },
  { category: 'Training', pattern: 'training.*', description: 'Access to training records and catalogs' },
  { category: 'Compliance', pattern: 'compliance.*', description: 'Access to compliance checks and violations' },
  { category: 'Documents', pattern: 'document.*', description: 'Access to document management' },
  { category: 'Reports', pattern: 'report.*', description: 'Read-only access to reports' },
  { category: 'Webhooks', pattern: 'webhook.*', description: 'Subscribe to platform events' },
] as const;
