/**
 * IBL Component 1 — IdentitySessionManager
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Manages the IdentitySession lifecycle:                      ║
 * ║    establish()  → freeze identity on login/session restore   ║
 * ║    clear()      → wipe identity on sign-out                  ║
 * ║    refresh()    → update tenant scopes without re-auth       ║
 * ║                                                              ║
 * ║  INVARIANT: IdentitySession is Object.freeze'd.              ║
 * ║  Only establish() and clear() can mutate the reference.      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { Session, User } from '@supabase/supabase-js';
import type { TenantRole, UserRole } from '@/domains/shared/types';
import { auditSecurity } from '../audit-security.service';
import type {
  IdentitySession,
  TenantScope,
  IdentityProvider,
} from '../identity-boundary.types';

// ════════════════════════════════════
// INPUT
// ════════════════════════════════════

export interface EstablishIdentityInput {
  user: User;
  session: Session;
  tenantMemberships: TenantScope[];
  allUserRoles: UserRole[];
  provider?: IdentityProvider;
}

export interface RefreshScopesInput {
  tenantMemberships: TenantScope[];
  allUserRoles: UserRole[];
}

// ════════════════════════════════════
// MANAGER
// ════════════════════════════════════

export class IdentitySessionManager {
  private _session: IdentitySession | null = null;

  /**
   * Establish identity from auth state.
   * Called once on login / session restore. Identity is frozen until sign-out.
   */
  establish(input: EstablishIdentityInput): IdentitySession {
    this._session = Object.freeze({
      userId: input.user.id,
      email: input.user.email ?? null,
      sessionFingerprint: input.session.access_token?.slice(-8) ?? null,
      authenticatedAt: Date.now(),
      tenantScopes: Object.freeze(input.tenantMemberships.map(m => Object.freeze(m))),
      allUserRoles: Object.freeze([...input.allUserRoles]),
      provider: input.provider ?? { type: 'supabase', method: 'email' },
    }) as IdentitySession;

    return this._session;
  }

  /**
   * Refresh tenant scopes and user roles without re-establishing identity.
   * Preserves userId, email, sessionFingerprint, authenticatedAt, provider.
   * Useful when memberships change while user is still logged in.
   */
  refresh(input: RefreshScopesInput): IdentitySession | null {
    if (!this._session) return null;

    this._session = Object.freeze({
      ...this._session,
      tenantScopes: Object.freeze(input.tenantMemberships.map(m => Object.freeze(m))),
      allUserRoles: Object.freeze([...input.allUserRoles]),
    }) as IdentitySession;

    return this._session;
  }

  /**
   * Clear identity on sign-out.
   */
  clear(): void {
    if (this._session) {
      auditSecurity.log({
        action: 'identity_cleared',
        resource: 'identity_session_manager',
        result: 'success',
        reason: 'Identity cleared on sign-out',
        user_id: this._session.userId,
      });
    }
    this._session = null;
  }

  get session(): IdentitySession | null {
    return this._session;
  }

  get isEstablished(): boolean {
    return this._session !== null;
  }
}
