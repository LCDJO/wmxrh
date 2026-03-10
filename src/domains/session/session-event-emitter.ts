/**
 * SessionEventEmitter — Logs session events to user_session_events via Session Service.
 * 
 * Event types: login, logout, token_refresh, page_view, api_request, permission_denied
 */

import { supabase } from '@/integrations/supabase/client';
import { getActiveSessionId } from './session-tracker';
import { logger } from '@/lib/logger';

export type SessionEventType =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'page_view'
  | 'api_request'
  | 'permission_denied';

/**
 * Emit a session event. Non-blocking — errors are logged but never thrown.
 */
export async function emitSessionEvent(
  eventType: SessionEventType,
  eventData: Record<string, any> = {}
): Promise<void> {
  const sessionId = getActiveSessionId();
  if (!sessionId) return; // no active session, skip silently

  try {
    await supabase.functions.invoke('session-service', {
      body: {
        action: 'log_event',
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
      },
    });
  } catch (err: any) {
    logger.warn('Failed to emit session event', { eventType, error: err.message });
  }
}

/**
 * Convenience: log a page view event.
 */
export function trackPageView(path: string, title?: string): void {
  emitSessionEvent('page_view', { path, title: title ?? document.title });
}

/**
 * Convenience: log a permission denied event.
 */
export function trackPermissionDenied(resource: string, action: string, reason?: string): void {
  emitSessionEvent('permission_denied', { resource, action, reason });
}
