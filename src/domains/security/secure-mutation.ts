/**
 * Security Middleware - Secure Mutation Wrapper
 * 
 * Pre-validates permissions and rate limits before executing mutations.
 * Use in React Query mutation hooks for consistent security enforcement.
 */

import { checkRateLimit, RATE_LIMITS } from './rate-limiter';
import { hasPermission, type PermissionEntity, type PermissionAction } from './permissions';
import type { TenantRole } from '@/domains/shared/types';

export class SecurityError extends Error {
  public code: 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'UNAUTHENTICATED';
  public retryAfterMs?: number;

  constructor(
    code: 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'UNAUTHENTICATED',
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
  /** Current user's effective roles */
  roles: TenantRole[];
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Rate limit key (defaults to entity:action) */
  rateLimitKey?: string;
  /** Rate limit config (defaults to RATE_LIMITS.create) */
  rateLimitConfig?: { windowMs: number; maxRequests: number };
}

/**
 * Validate security constraints before a mutation.
 * Throws SecurityError if any check fails.
 */
export function validateMutation(opts: SecureMutationOptions): void {
  // 1. Authentication check
  if (!opts.isAuthenticated) {
    throw new SecurityError('UNAUTHENTICATED', 'Usuário não autenticado.');
  }

  // 2. Permission check
  if (!hasPermission(opts.entity, opts.action, opts.roles)) {
    throw new SecurityError(
      'PERMISSION_DENIED',
      `Sem permissão para ${opts.action} em ${opts.entity}.`
    );
  }

  // 3. Rate limit check
  const rateLimitKey = opts.rateLimitKey || `${opts.entity}:${opts.action}`;
  const rateLimitConfig = opts.rateLimitConfig || RATE_LIMITS.create;
  const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, rateLimitConfig);

  if (!allowed) {
    throw new SecurityError(
      'RATE_LIMITED',
      `Muitas requisições. Tente novamente em ${Math.ceil((retryAfterMs || 0) / 1000)}s.`,
      retryAfterMs
    );
  }
}

/**
 * Wraps a mutation function with security validation.
 * Returns a new function that checks permissions and rate limits first.
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
