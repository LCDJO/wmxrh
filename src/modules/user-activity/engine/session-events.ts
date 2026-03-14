/**
 * Session Event Emitter — Records events and emits to Global Event Kernel.
 */
import { supabase } from '@/integrations/supabase/client';
import { getActiveSessionId } from '@/domains/session/session-tracker';

export type SessionEventType =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'page_view'
  | 'api_request'
  | 'permission_denied'
  | 'session_blocked'
  | 'remote_logout';

export async function emitSessionEvent(
  eventType: SessionEventType,
  eventData: Record<string, unknown> = {},
  userId?: string,
  tenantId?: string | null
): Promise<void> {
  const sessionId = getActiveSessionId();
  if (!sessionId && eventType !== 'login') return;

  try {
    await supabase.from('user_session_events').insert({
      session_id: sessionId,
      user_id: userId,
      tenant_id: tenantId ?? null,
      event_type: eventType,
      event_data: eventData,
      timestamp: new Date().toISOString(),
    } as any);
  } catch (err) {
    console.error('[SessionEvent] emit failed:', err);
  }
}

/**
 * Block a session remotely (platform admin action).
 * Uses SECURITY DEFINER RPC to bypass RLS.
 */
export async function blockSession(
  sessionId: string,
  blockedBy: string,
  reason: string
): Promise<boolean> {
  // Use admin RPC that validates platform role server-side
  const { data, error } = await supabase.rpc('admin_logout_session', {
    p_session_id: sessionId,
    p_performed_by: blockedBy,
  });

  if (error) {
    console.error('[SessionEvent] blockSession RPC failed:', error);
    return false;
  }

  if (data === false) {
    console.error('[SessionEvent] blockSession: permission denied');
    return false;
  }

  return true;
}

/**
 * Force remote logout of a session.
 * Uses SECURITY DEFINER RPC to bypass RLS.
 */
export async function remoteLogout(
  sessionId: string,
  performedBy: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_logout_session', {
    p_session_id: sessionId,
    p_performed_by: performedBy,
  });

  if (error) {
    console.error('[SessionEvent] remoteLogout RPC failed:', error);
    return false;
  }

  if (data === false) {
    console.error('[SessionEvent] remoteLogout: permission denied');
    return false;
  }

  return true;
}
