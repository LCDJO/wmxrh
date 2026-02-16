/**
 * MultiSessionService — Future: manages simultaneous org sessions
 *
 * Stub service. Full implementation will:
 *   - Maintain independent auth tokens per tenant
 *   - Handle session expiry/renewal per org
 *   - Emit events for UI tab management
 *   - Enforce max concurrent session limits
 */

import type {
  OrgSession,
  MultiSessionState,
  MultiSessionEvent,
  AddOrgSessionCommand,
  RemoveOrgSessionCommand,
  FocusOrgSessionCommand,
} from './types';

type MultiSessionListener = (event: MultiSessionEvent) => void;

export class MultiSessionService {
  private _state: MultiSessionState = {
    sessions: new Map(),
    primary_tenant_id: null,
    max_sessions: 5,
    total_badge_count: 0,
  };

  private _listeners: MultiSessionListener[] = [];

  // ── Queries ──

  get state(): MultiSessionState {
    return this._state;
  }

  get primarySession(): OrgSession | null {
    if (!this._state.primary_tenant_id) return null;
    return this._state.sessions.get(this._state.primary_tenant_id) ?? null;
  }

  getSession(tenantId: string): OrgSession | null {
    return this._state.sessions.get(tenantId) ?? null;
  }

  get activeSessions(): OrgSession[] {
    return Array.from(this._state.sessions.values())
      .filter(s => s.status === 'active' || s.status === 'background');
  }

  get canAddSession(): boolean {
    return this.activeSessions.length < this._state.max_sessions;
  }

  // ── Commands (stubs — emit events for future wiring) ──

  addSession(_cmd: AddOrgSessionCommand): boolean {
    // TODO: Authenticate to tenant, create OrgSession, store token
    console.info('[MultiSession] addSession — stub', _cmd);
    return false;
  }

  removeSession(_cmd: RemoveOrgSessionCommand): boolean {
    // TODO: Remove session, optionally revoke token
    console.info('[MultiSession] removeSession — stub', _cmd);
    return false;
  }

  focusSession(_cmd: FocusOrgSessionCommand): boolean {
    // TODO: Set primary_tenant_id, emit OrgSessionFocused
    console.info('[MultiSession] focusSession — stub', _cmd);
    return false;
  }

  // ── Event Bus ──

  onEvent(listener: MultiSessionListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  private _emit(event: MultiSessionEvent): void {
    this._listeners.forEach(l => {
      try { l(event); } catch (e) { console.error('[MultiSession] listener error', e); }
    });
  }
}

/** Singleton */
export const multiSessionService = new MultiSessionService();
