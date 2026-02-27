/**
 * UIFE — SessionManager
 *
 * Manages federation sessions across protocols.
 * Backed by federation_sessions table.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  SessionManagerAPI,
  FederationSession,
  CreateSessionParams,
} from './types';

export function createSessionManager(): SessionManagerAPI {
  return {
    async create(params) {
      const { data, error } = await supabase
        .from('federation_sessions')
        .insert({
          tenant_id: params.tenant_id,
          idp_config_id: params.idp_config_id,
          protocol: params.protocol,
          ip_address: params.ip_address ?? null,
          user_agent: params.user_agent ?? null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(`[UIFE:Session] create failed: ${error.message}`);
      return data as unknown as FederationSession;
    },

    async authenticate(sessionId, userId, attributes) {
      const { data, error } = await supabase
        .from('federation_sessions')
        .update({
          user_id: userId,
          attributes: attributes as import('@/integrations/supabase/types').Json,
          status: 'authenticated',
          authenticated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), // 8h
        })
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
