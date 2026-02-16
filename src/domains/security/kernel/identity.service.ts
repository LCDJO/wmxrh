/**
 * SecurityKernel — IdentityService
 * 
 * Resolves the current user's identity from AuthContext.
 * Pure data accessor — no business logic.
 */

import type { User, Session } from '@supabase/supabase-js';

export interface Identity {
  userId: string;
  email: string | null;
  session: Session;
}

/**
 * Extract identity from auth state.
 * Returns null if not authenticated.
 */
export function resolveIdentity(
  user: User | null,
  session: Session | null
): Identity | null {
  if (!user || !session) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    session,
  };
}
