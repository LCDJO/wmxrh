/**
 * Security Middleware - Secure Mutation Wrapper
 * 
 * Integrates with SecurityKernel pipeline.
 * Pre-validates permissions, policies, and rate limits before executing mutations.
 * 
 * Domain services (HR, Compensation) call this instead of checking roles directly.
 */

import { checkRateLimit, RATE_LIMITS } from './rate-limiter';
import type { PermissionEntity, PermissionAction } from './permissions';
import type { SecurityContext } from './kernel/identity.service';
import type { ResourceTarget } from './kernel/permission-engine';
import { executeSecurityPipeline } from './kernel/security-pipeline';
import { auditSecurity } from './kernel/audit-security.service';

export class SecurityError extends Error {
  public code: 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'UNAUTHENTICATED' | 'POLICY_DENIED';
  public retryAfterMs?: number;

  constructor(
    code: 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'UNAUTHENTICATED' | 'POLICY_DENIED',
    message: string,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

interface SecureMutationOptions {
  /** Entity being mutated */
  entity: PermissionEntity;
  /** Action being performed */
  action: PermissionAction;
  /** SecurityContext (preferred over roles) */
  ctx?: SecurityContext | null;
  /** Target entity for ABAC scope matching */
  target?: ResourceTarget;
  /** Rate limit key (defaults to entity:action) */
  rateLimitKey?: string;
  /** Rate limit config */
  rateLimitConfig?: { windowMs: number; maxRequests: number };
}

/**
 * Validate security constraints through the full pipeline.
 * Throws SecurityError if any check fails.
 */
export function validateMutation(opts: SecureMutationOptions): void {
  const resource = `${opts.entity}:${opts.action}`;

  // ── Pipeline: Auth → Scope → Permission → Policy → Audit ──
  const pipelineResult = executeSecurityPipeline({
    action: opts.action,
    resource: opts.entity,
    ctx: opts.ctx || null,
    target: opts.target,
  });

  if (pipelineResult.decision === 'deny') {
    const codeMap: Record<string, SecurityError['code']> = {
      auth: 'UNAUTHENTICATED',
      permission: 'PERMISSION_DENIED',
      policy: 'POLICY_DENIED',
    };
    throw new SecurityError(
      codeMap[pipelineResult.deniedBy || 'permission'] || 'PERMISSION_DENIED',
      pipelineResult.reason || `Acesso negado: ${opts.action} em ${opts.entity}.`,
    );
  }

  // ── Rate limit check (after permission passes) ──
  const rateLimitKey = opts.rateLimitKey || resource;
  const rateLimitConfig = opts.rateLimitConfig || RATE_LIMITS.create;
  const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, rateLimitConfig);

  if (!allowed) {
    auditSecurity.logRateLimited({
      resource,
      reason: `Muitas requisições. Tente novamente em ${Math.ceil((retryAfterMs || 0) / 1000)}s.`,
      ctx: opts.ctx,
      retryAfterMs,
    });
    throw new SecurityError(
      'RATE_LIMITED',
      `Muitas requisições. Tente novamente em ${Math.ceil((retryAfterMs || 0) / 1000)}s.`,
      retryAfterMs
    );
  }
}

/**
 * Wraps a mutation function with full security pipeline validation.
 */
export function secureMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  getSecurityOpts: (args: TArgs) => SecureMutationOptions
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    validateMutation(getSecurityOpts(args));
    return mutationFn(args);
  };
}
