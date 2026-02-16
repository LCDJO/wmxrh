/**
 * IBL Component 2 — ContextSwitcherService
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Handles context switching with full validation:             ║
 * ║                                                              ║
 * ║  switchContext({ tenant_id, group_id?, company_id? })        ║
 * ║                                                              ║
 * ║  RULES:                                                      ║
 * ║    1. Identity must be established                           ║
 * ║    2. User must have membership in target tenant             ║
 * ║    3. Validate via AccessGraph before switching               ║
 * ║    4. Emit ContextSwitched event                              ║
 * ║    5. Update SecurityContext atomically (Object.freeze)       ║
 * ║    6. Audit every switch attempt (success or failure)         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { ScopeType } from '@/domains/shared/types';
import { auditSecurity } from '../audit-security.service';
import { contextResolver } from './context-resolver';
import { getAccessGraph } from '../access-graph';
import type {
  IdentitySession,
  OperationalContext,
  ContextSwitchRequest,
  ContextSwitchResult,
} from '../identity-boundary.types';

// ════════════════════════════════════
// CONTEXT SWITCHED EVENT
// ════════════════════════════════════

export interface ContextSwitchedEvent {
  type: 'ContextSwitched';
  timestamp: number;
  userId: string;
  previousContext: ContextSnapshot | null;
  newContext: ContextSnapshot;
  switchType: 'tenant' | 'group' | 'company' | 'scope';
  switchCount: number;
}

export interface ContextSnapshot {
  tenantId: string;
  tenantName: string;
  scopeLevel: ScopeType;
  groupId: string | null;
  companyId: string | null;
}

type ContextSwitchedListener = (event: ContextSwitchedEvent) => void;

// ════════════════════════════════════
// SERVICE
// ════════════════════════════════════

export class ContextSwitcherService {
  private _currentContext: OperationalContext | null = null;
  private _switchCount = 0;
  private _listeners = new Set<ContextSwitchedListener>();

  /**
   * Subscribe to ContextSwitched events.
   * Returns an unsubscribe function.
   */
  onContextSwitched(listener: ContextSwitchedListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Switch operational context (tenant, group, or company).
   * 
   * FLOW:
   *   1. Validate identity exists
   *   2. Validate membership in target tenant
   *   3. Validate via AccessGraph (O(1) scope check)
   *   4. Build new OperationalContext (frozen)
   *   5. Emit ContextSwitched event
   *   6. Audit the switch
   */
  switch(
    identity: IdentitySession | null,
    request: ContextSwitchRequest,
  ): ContextSwitchResult {
    // ── 1. Identity must exist ──
    if (!identity) {
      return this._deny('NO_IDENTITY', 'Nenhuma identidade estabelecida. Autentique-se primeiro.');
    }

    const targetTenantId = request.targetTenantId ?? this._currentContext?.activeTenantId;

    if (!targetTenantId) {
      return this._deny('NO_MEMBERSHIP', 'Nenhum tenant alvo especificado e nenhum contexto ativo.');
    }

    // ── 2. Membership check ──
    const membership = identity.tenantScopes.find(m => m.tenantId === targetTenantId);
    if (!membership) {
      auditSecurity.logAccessDenied({
        resource: `tenant:${targetTenantId}`,
        reason: 'Tentativa de troca para tenant sem membership',
      });
      return this._deny('NO_MEMBERSHIP', `Sem acesso ao tenant ${targetTenantId}.`);
    }

    // ── Resolve target scope ──
    const scopeLevel = request.targetScopeLevel ?? this._currentContext?.scopeLevel ?? 'tenant';
    const groupId = request.targetGroupId ?? (request.targetTenantId ? null : this._currentContext?.activeGroupId ?? null);
    const companyId = request.targetCompanyId ?? (request.targetTenantId ? null : this._currentContext?.activeCompanyId ?? null);

    // ── 3. Validate via AccessGraph (O(1)) ──
    const graphValidation = this._validateViaAccessGraph(identity, targetTenantId, scopeLevel, groupId, companyId);
    if (!graphValidation.allowed) {
      auditSecurity.logAccessDenied({
        resource: `scope:${scopeLevel}:${groupId || companyId || 'tenant'}`,
        reason: graphValidation.reason,
      });
      return this._deny('SCOPE_DENIED', graphValidation.reason);
    }

    // ── Resolve effective context ──
    const resolved = contextResolver.resolve(identity, membership.role, targetTenantId);

    // ── 4. Build new context (atomic, frozen) ──
    const previousContext = this._currentContext;
    const previousTenantId = previousContext?.activeTenantId;

    this._currentContext = Object.freeze({
      activeTenantId: targetTenantId,
      activeTenantName: membership.tenantName,
      membershipRole: membership.role,
      activeUserRoles: Object.freeze([...resolved.tenantUserRoles]),
      effectiveRoles: Object.freeze(resolved.effectiveRoles),
      scopeLevel,
      activeGroupId: groupId,
      activeCompanyId: companyId,
      activatedAt: Date.now(),
      expiresAt: null,
    }) as OperationalContext;

    this._switchCount++;

    // ── Determine switch type ──
    const switchType = this._classifySwitchType(previousTenantId, targetTenantId, previousContext, request);

    // ── 5. Emit ContextSwitched event ──
    this._emitContextSwitched(identity.userId, previousContext, this._currentContext, switchType);

    // ── 6. Audit ──
    const action = switchType === 'tenant' ? 'tenant_switched' : 'scope_switched';
    auditSecurity.log({
      action,
      resource: 'context_switcher',
      result: 'success',
      reason: `Context switched: ${switchType}`,
      user_id: identity.userId,
      tenant_id: targetTenantId,
      metadata: {
        switchType,
        fromTenant: previousTenantId ?? null,
        toTenant: targetTenantId,
        scopeLevel,
        groupId,
        companyId,
        switchCount: this._switchCount,
        validatedBy: graphValidation.validatedBy,
      },
    });

    return {
      success: true,
      newContext: this._currentContext,
      reason: this._buildSuccessMessage(switchType, membership.tenantName, scopeLevel, groupId, companyId),
    };
  }

  get currentContext(): OperationalContext | null {
    if (this._currentContext?.expiresAt) {
      if (Date.now() > this._currentContext.expiresAt) {
        this._currentContext = null;
        return null;
      }
    }
    return this._currentContext;
  }

  get switchCount(): number {
    return this._switchCount;
  }

  clear(): void {
    this._currentContext = null;
    this._switchCount = 0;
  }

  // ════════════════════════════════════
  // PRIVATE — AccessGraph validation
  // ════════════════════════════════════

  private _validateViaAccessGraph(
    identity: IdentitySession,
    tenantId: string,
    scopeLevel: ScopeType,
    groupId: string | null,
    companyId: string | null,
  ): { allowed: boolean; reason: string; validatedBy: 'access_graph' | 'identity_session' | 'context_resolver' } {

    // Strategy 1: Use live AccessGraph if available (O(1) lookups)
    const graph = getAccessGraph();
    if (graph) {
      // Company scope: check reachability in graph
      if (companyId) {
        if (!graph.canAccessScope('company', companyId)) {
          return {
            allowed: false,
            reason: `AccessGraph: empresa ${companyId} não é alcançável pelo usuário`,
            validatedBy: 'access_graph',
          };
        }
      }

      // Group scope: check reachability in graph
      if (groupId) {
        if (!graph.canAccessScope('company_group', groupId)) {
          return {
            allowed: false,
            reason: `AccessGraph: grupo ${groupId} não é alcançável pelo usuário`,
            validatedBy: 'access_graph',
          };
        }
      }

      return { allowed: true, reason: 'AccessGraph validation passed', validatedBy: 'access_graph' };
    }

    // Strategy 2: Use IdentitySession.allowedScopes (snapshot from establish)
    if (identity.allowedScopes) {
      if (identity.allowedScopes.hasTenantWideAccess) {
        return { allowed: true, reason: 'Tenant-wide access (from session)', validatedBy: 'identity_session' };
      }

      if (companyId && !identity.allowedScopes.companyIds.includes(companyId)) {
        return {
          allowed: false,
          reason: `IdentitySession: empresa ${companyId} não está nos scopes permitidos`,
          validatedBy: 'identity_session',
        };
      }

      if (groupId && !identity.allowedScopes.groupIds.includes(groupId)) {
        return {
          allowed: false,
          reason: `IdentitySession: grupo ${groupId} não está nos scopes permitidos`,
          validatedBy: 'identity_session',
        };
      }

      return { allowed: true, reason: 'IdentitySession scope validation passed', validatedBy: 'identity_session' };
    }

    // Strategy 3: Fallback to ContextResolver (role-based validation)
    const resolved = contextResolver.resolve(identity, identity.tenantScopes.find(m => m.tenantId === tenantId)?.role ?? 'viewer', tenantId);
    const scopeValidation = contextResolver.validateScopeAccess(
      resolved.effectiveRoles,
      resolved.tenantUserRoles,
      scopeLevel,
      groupId,
      companyId,
    );

    return {
      allowed: scopeValidation.allowed,
      reason: scopeValidation.reason,
      validatedBy: 'context_resolver',
    };
  }

  // ════════════════════════════════════
  // PRIVATE — Event emission
  // ════════════════════════════════════

  private _emitContextSwitched(
    userId: string,
    previousContext: OperationalContext | null,
    newContext: OperationalContext,
    switchType: ContextSwitchedEvent['switchType'],
  ): void {
    const event: ContextSwitchedEvent = {
      type: 'ContextSwitched',
      timestamp: Date.now(),
      userId,
      previousContext: previousContext
        ? {
            tenantId: previousContext.activeTenantId,
            tenantName: previousContext.activeTenantName,
            scopeLevel: previousContext.scopeLevel,
            groupId: previousContext.activeGroupId,
            companyId: previousContext.activeCompanyId,
          }
        : null,
      newContext: {
        tenantId: newContext.activeTenantId,
        tenantName: newContext.activeTenantName,
        scopeLevel: newContext.scopeLevel,
        groupId: newContext.activeGroupId,
        companyId: newContext.activeCompanyId,
      },
      switchType,
      switchCount: this._switchCount,
    };

    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors to not break the switch flow
      }
    }
  }

  // ════════════════════════════════════
  // PRIVATE — Helpers
  // ════════════════════════════════════

  private _classifySwitchType(
    previousTenantId: string | undefined,
    targetTenantId: string,
    previousContext: OperationalContext | null,
    request: ContextSwitchRequest,
  ): ContextSwitchedEvent['switchType'] {
    if (previousTenantId && previousTenantId !== targetTenantId) return 'tenant';
    if (request.targetCompanyId !== undefined) return 'company';
    if (request.targetGroupId !== undefined) return 'group';
    if (request.targetScopeLevel && request.targetScopeLevel !== previousContext?.scopeLevel) return 'scope';
    return 'scope';
  }

  private _deny(
    failedValidation: ContextSwitchResult['failedValidation'],
    reason: string,
  ): ContextSwitchResult {
    return { success: false, newContext: null, reason, failedValidation };
  }

  private _buildSuccessMessage(
    switchType: string,
    tenantName: string,
    scopeLevel: ScopeType,
    groupId: string | null,
    companyId: string | null,
  ): string {
    switch (switchType) {
      case 'tenant':
        return `Contexto trocado para tenant ${tenantName}`;
      case 'company':
        return `Escopo atualizado para empresa ${companyId}`;
      case 'group':
        return `Escopo atualizado para grupo ${groupId}`;
      default:
        return `Escopo atualizado para ${scopeLevel}`;
    }
  }
}
