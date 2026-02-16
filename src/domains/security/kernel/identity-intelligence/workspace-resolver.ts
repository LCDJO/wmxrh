/**
 * WorkspaceResolver — Manages workspace listing, switching, and restoration.
 *
 * Responsibilities:
 *   - List available workspaces (tenants) from IBL
 *   - Switch workspace via IBL.switchContext
 *   - Persist/restore last workspace from localStorage
 *   - Emit WorkspaceSwitched events
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import { auditSecurity } from '../audit-security.service';
import type {
  WorkspaceEntry,
  IILWorkspaceSwitchedEvent,
  IILAnomalyDetectedEvent,
} from './types';

const LAST_WORKSPACE_KEY = 'iil:last_workspace';

export type WorkspaceEventCallback = (event: IILWorkspaceSwitchedEvent | IILAnomalyDetectedEvent) => void;

export class WorkspaceResolver {
  private _onEvent: WorkspaceEventCallback;

  constructor(onEvent: WorkspaceEventCallback) {
    this._onEvent = onEvent;
  }

  /**
   * Get all available workspaces from IBL identity session.
   */
  getAvailableWorkspaces(): WorkspaceEntry[] {
    const session = identityBoundary.identity;
    if (!session) return [];

    return session.tenantScopes.map(scope => ({
      tenantId: scope.tenantId,
      tenantName: scope.tenantName,
      role: scope.role,
      scopeLevel: null,
      groupId: null,
      companyId: null,
    }));
  }

  /**
   * Switch to a different workspace. Returns true on success.
   * Caller is responsible for recording context history before calling.
   */
  switchWorkspace(
    tenantId: string,
    method: 'explicit' | 'auto_restore' | 'initial' = 'explicit',
  ): boolean {
    const session = identityBoundary.identity;
    if (!session) return false;

    if (!identityBoundary.canSwitchToTenant(tenantId)) {
      this._onEvent({
        type: 'AnomalyDetected',
        timestamp: Date.now(),
        userId: session.userId,
        anomaly: 'WORKSPACE_SWITCH_DENIED',
        detail: `No membership for tenant ${tenantId}`,
      });
      return false;
    }

    const previousTenantId = identityBoundary.operationalContext?.activeTenantId ?? null;

    const result = identityBoundary.switchContext({ targetTenantId: tenantId });
    if (!result.success) return false;

    this._persistLastWorkspace(tenantId);

    const targetScope = session.tenantScopes.find(s => s.tenantId === tenantId);
    this._onEvent({
      type: 'WorkspaceSwitched',
      timestamp: Date.now(),
      userId: session.userId,
      fromTenantId: previousTenantId,
      toTenantId: tenantId,
      toTenantName: targetScope?.tenantName ?? tenantId,
      switchMethod: method,
    });

    auditSecurity.log({
      action: 'workspace_switched',
      resource: 'identity_intelligence',
      result: 'success',
      reason: `Workspace switched to ${targetScope?.tenantName ?? tenantId}`,
      user_id: session.userId,
      tenant_id: tenantId,
      metadata: { method, fromTenantId: previousTenantId },
    });

    return true;
  }

  /**
   * Restore the last workspace from localStorage.
   */
  restoreLastWorkspace(): string | null {
    try {
      const saved = localStorage.getItem(LAST_WORKSPACE_KEY);
      if (!saved) return null;

      const { tenantId } = JSON.parse(saved);
      if (!tenantId) return null;

      if (!identityBoundary.canSwitchToTenant(tenantId)) return null;

      if (this.switchWorkspace(tenantId, 'auto_restore')) {
        return tenantId;
      }
    } catch { /* corrupted */ }
    return null;
  }

  private _persistLastWorkspace(tenantId: string): void {
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify({ tenantId, savedAt: Date.now() }));
    } catch { /* storage full */ }
  }
}
