/**
 * IBL Component 2 — ContextSwitcherService
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Handles context switching with full validation:             ║
 * ║    1. Identity must be established                           ║
 * ║    2. User must have membership in target tenant             ║
 * ║    3. Scope access must be validated                         ║
 * ║    4. Context is built atomically (Object.freeze)            ║
 * ║    5. Every switch emits an audit event                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import { auditSecurity } from '../audit-security.service';
import { contextResolver } from './context-resolver';
import type {
  IdentitySession,
  OperationalContext,
  ContextSwitchRequest,
  ContextSwitchResult,
} from '../identity-boundary.types';

// ════════════════════════════════════
// SERVICE
// ════════════════════════════════════

export class ContextSwitcherService {
  private _currentContext: OperationalContext | null = null;
  private _switchCount = 0;

  /**
   * Switch operational context (tenant, group, or company).
   * Validates against the established identity grants.
   */
  switch(
    identity: IdentitySession | null,
    request: ContextSwitchRequest,
  ): ContextSwitchResult {
    // ── Validation 1: Identity must exist ──
    if (!identity) {
      return {
        success: false,
        newContext: null,
        reason: 'Nenhuma identidade estabelecida. Autentique-se primeiro.',
        failedValidation: 'NO_IDENTITY',
      };
    }

    const targetTenantId = request.targetTenantId ?? this._currentContext?.activeTenantId;

    if (!targetTenantId) {
      return {
        success: false,
        newContext: null,
        reason: 'Nenhum tenant alvo especificado e nenhum contexto ativo.',
        failedValidation: 'NO_MEMBERSHIP',
      };
    }

    // ── Validation 2: User must have membership in target tenant ──
    const membership = identity.tenantScopes.find(m => m.tenantId === targetTenantId);
    if (!membership) {
      auditSecurity.logAccessDenied({
        resource: `tenant:${targetTenantId}`,
        reason: 'Tentativa de troca para tenant sem membership',
      });
      return {
        success: false,
        newContext: null,
        reason: `Sem acesso ao tenant ${targetTenantId}.`,
        failedValidation: 'NO_MEMBERSHIP',
      };
    }

    // ── Resolve effective context ──
    const resolved = contextResolver.resolve(identity, membership.role, targetTenantId);

    // ── Validation 3: Scope access ──
    const scopeLevel = request.targetScopeLevel ?? this._currentContext?.scopeLevel ?? 'tenant';
    const groupId = request.targetGroupId ?? (request.targetTenantId ? null : this._currentContext?.activeGroupId ?? null);
    const companyId = request.targetCompanyId ?? (request.targetTenantId ? null : this._currentContext?.activeCompanyId ?? null);

    const scopeValidation = contextResolver.validateScopeAccess(
      resolved.effectiveRoles,
      resolved.tenantUserRoles,
      scopeLevel,
      groupId,
      companyId,
    );

    if (!scopeValidation.allowed) {
      auditSecurity.logAccessDenied({
        resource: `scope:${scopeLevel}:${groupId || companyId || 'tenant'}`,
        reason: scopeValidation.reason,
      });
      return {
        success: false,
        newContext: null,
        reason: scopeValidation.reason,
        failedValidation: 'SCOPE_DENIED',
      };
    }

    // ── Build new context ──
    const previousTenantId = this._currentContext?.activeTenantId;
    const isTenantSwitch = !!previousTenantId && previousTenantId !== targetTenantId;

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

    // ── Audit ──
    auditSecurity.log({
      action: isTenantSwitch ? 'tenant_switched' : 'scope_switched',
      resource: 'context_switcher',
      result: 'success',
      reason: isTenantSwitch ? 'Tenant switched' : 'Scope switched',
      user_id: identity.userId,
      tenant_id: targetTenantId,
      metadata: {
        fromTenant: previousTenantId,
        toTenant: targetTenantId,
        scopeLevel,
        groupId,
        companyId,
        switchCount: this._switchCount,
      },
    });

    return {
      success: true,
      newContext: this._currentContext,
      reason: isTenantSwitch
        ? `Contexto trocado para tenant ${membership.tenantName}`
        : `Escopo atualizado para ${scopeLevel}${groupId ? `:${groupId}` : ''}${companyId ? `:${companyId}` : ''}`,
    };
  }

  get currentContext(): OperationalContext | null {
    // Check expiration
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
}
