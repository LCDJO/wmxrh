/**
 * UIFE — SessionManager
 *
 * Manages federation sessions across protocols.
 * Backed by federation_sessions table.
 *
 * UnifiedIdentitySession is the canonical session envelope that
 * captures WHO authenticated, FROM WHERE, and WHEN.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  SessionManagerAPI,
  FederationSession,
  CreateSessionParams,
} from './types';

// ════════════════════════════════════
// UNIFIED IDENTITY SESSION
// ════════════════════════════════════

export interface UnifiedIdentitySession {
  /** Session ID (federation_sessions.id) */
  session_id: string;
  /** Authenticated user ID */
  user_id: string;
  /** Tenant this session belongs to */
  tenant_id: string;
  /** Identity Provider source (e.g. "saml:okta", "oidc:azure", "local") */
  idp_source: string;
  /** Protocol used for authentication */
  protocol: string;
  /** IdP config ID (references identity_provider_configs) */
  idp_config_id: string;
  /** When the session was issued */
  issued_at: string;
  /** When the session expires */
  expires_at: string;
  /** When the session was authenticated */
  authenticated_at: string | null;
  /** Current status */
  status: string;
  /** IP address of the client */
  ip_address: string | null;
  /** User agent string */
  user_agent: string | null;
  /** Device fingerprint for binding */
  device_fingerprint: string | null;
  /** Scopes granted in this session */
  scopes: string[];
  /** Last activity timestamp */
  last_activity_at: string | null;
  /** Attributes from the IdP assertion */
  attributes: Record<string, unknown>;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function toUnifiedSession(row: any): UnifiedIdentitySession {
  return {
    session_id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    idp_source: row.idp_source || `${row.protocol}:${row.idp_config_id?.slice(0, 8)}`,
    protocol: row.protocol,
    idp_config_id: row.idp_config_id,
    issued_at: row.started_at || row.created_at,
    expires_at: row.expires_at || '',
    authenticated_at: row.authenticated_at,
    status: row.status,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    device_fingerprint: row.device_fingerprint,
    scopes: row.scopes || [],
    last_activity_at: row.last_activity_at,
    attributes: (row.attributes as Record<string, unknown>) || {},
  };
}

function generateFingerprint(): string {
  try {
    const nav = window.navigator;
    const raw = [
      nav.userAgent,
      nav.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  } catch {
    return `fp-${Date.now().toString(36)}`;
  }
}

// ════════════════════════════════════
// SESSION MANAGER
// ════════════════════════════════════

export function createSessionManager(): SessionManagerAPI {
  return {
    async create(params) {
      const fingerprint = typeof window !== 'undefined' ? generateFingerprint() : null;

      const { data, error } = await supabase
        .from('federation_sessions')
        .insert({
          tenant_id: params.tenant_id,
          idp_config_id: params.idp_config_id,
          protocol: params.protocol,
          ip_address: params.ip_address ?? null,
          user_agent: params.user_agent ?? null,
          status: 'pending',
          idp_source: `${params.protocol}:${params.idp_config_id?.slice(0, 8)}` as any,
          device_fingerprint: fingerprint as any,
          scopes: [] as any,
        } as any)
        .select()
        .single();

      if (error) throw new Error(`[UIFE:Session] create failed: ${error.message}`);
      return data as unknown as FederationSession;
    },

    async authenticate(sessionId, userId, attributes) {
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString(); // 8h

      const { data, error } = await supabase
        .from('federation_sessions')
        .update({
          user_id: userId,
          attributes: attributes as import('@/integrations/supabase/types').Json,
          status: 'authenticated',
          authenticated_at: new Date().toISOString(),
          expires_at: expiresAt,
          last_activity_at: new Date().toISOString() as any,
        } as any)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw new Error(`[UIFE:Session] authenticate failed: ${error.message}`);
      return data as unknown as FederationSession;
    },

    async getActiveSessions(userId, tenantId) {
      const { data, error } = await supabase
        .from('federation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('status', 'authenticated')
        .gt('expires_at', new Date().toISOString())
        .order('authenticated_at', { ascending: false });

      if (error) {
        console.error('[UIFE:Session] getActiveSessions failed:', error.message);
        return [];
      }
      return (data ?? []) as unknown as FederationSession[];
    },

    async revoke(sessionId, reason) {
      await supabase
        .from('federation_sessions')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      console.log(`[UIFE:Session] Revoked session ${sessionId}${reason ? `: ${reason}` : ''}`);
    },

    async revokeAll(userId, tenantId) {
      const { data } = await supabase
        .from('federation_sessions')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('status', 'authenticated')
        .select('id');

      return data?.length ?? 0;
    },

    async isValid(sessionId) {
      const { data } = await supabase
        .from('federation_sessions')
        .select('status, expires_at')
        .eq('id', sessionId)
        .maybeSingle();

      if (!data) return false;
      if (data.status !== 'authenticated') return false;
      if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
      return true;
    },

    async cleanup(tenantId) {
      const { data } = await supabase
        .from('federation_sessions')
        .update({ status: 'expired' })
        .eq('tenant_id', tenantId)
        .eq('status', 'authenticated')
        .lt('expires_at', new Date().toISOString())
        .select('id');

      return data?.length ?? 0;
    },
  };
}

// ════════════════════════════════════
// UNIFIED SESSION HELPERS
// ════════════════════════════════════

/**
 * Get UnifiedIdentitySession for a session ID.
 */
export async function getUnifiedSession(sessionId: string): Promise<UnifiedIdentitySession | null> {
  const { data, error } = await supabase
    .from('federation_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return toUnifiedSession(data);
}

/**
 * Get all active UnifiedIdentitySessions for a user in a tenant.
 */
export async function getActiveUnifiedSessions(
  userId: string,
  tenantId: string,
): Promise<UnifiedIdentitySession[]> {
  const { data, error } = await supabase
    .from('federation_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'authenticated')
    .gt('expires_at', new Date().toISOString())
    .order('authenticated_at', { ascending: false });

  if (error) return [];
  return (data || []).map(toUnifiedSession);
}

/**
 * Touch session — update last_activity_at for session keepalive.
 */
export async function touchSession(sessionId: string): Promise<void> {
  await (supabase
    .from('federation_sessions')
    .update({ last_activity_at: new Date().toISOString() } as any)
    .eq('id', sessionId) as any);
}

/**
 * Extend session expiry.
 */
export async function extendSession(sessionId: string, additionalHours = 8): Promise<void> {
  const newExpiry = new Date(Date.now() + additionalHours * 3600 * 1000).toISOString();
  await supabase
    .from('federation_sessions')
    .update({ expires_at: newExpiry })
    .eq('id', sessionId);
}
