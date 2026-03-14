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
 */
export async function blockSession(
  sessionId: string,
  blockedBy: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_sessions')
    .update({
      status: 'offline',
      blocked_at: new Date().toISOString(),
      blocked_by: blockedBy,
      blocked_reason: reason,
      logout_at: new Date().toISOString(),
    } as any)
    .eq('id', sessionId);

  if (!error) {
    await emitSessionEvent('session_blocked', { session_id: sessionId, reason }, blockedBy);
  }
  return !error;
}

/**
 * Force remote logout of a session.
 */
export async function remoteLogout(
  sessionId: string,
  performedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_sessions')
    .update({
      status: 'offline',
      logout_at: new Date().toISOString(),
    } as any)
    .eq('id', sessionId);

  if (!error) {
    await emitSessionEvent('remote_logout', { session_id: sessionId, performed_by: performedBy }, performedBy);
  }
  return !error;
}
