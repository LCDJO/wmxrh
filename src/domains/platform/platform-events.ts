/**
 * Platform Domain Events
 *
 * Events emitted by platform-level operations.
 * Dual-layer: client-side bus + security_logs persistence.
 *
 * Events:
 *   PlatformUserLoggedIn     — platform admin authenticated
 *   TenantCreated            — new tenant provisioned
 *   TenantSuspended          — tenant suspended/reactivated
 *   PlatformPermissionChanged — platform role or permission modified
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════
// Event Types
// ═══════════════════════════════════

export type PlatformEventType =
  | 'PlatformUserLoggedIn'
  | 'TenantCreated'
  | 'TenantSuspended'
  | 'TenantReactivated'
  | 'PlatformPermissionChanged'
  // Cognitive Layer events
  | 'UserBehaviorTracked'
  | 'RoleSuggestionGenerated'
  | 'PermissionRiskDetected'
  | 'NavigationHintCreated'
  // Billing events
  | 'PlanAssignedToTenant'
  | 'PlanUpgraded'
  | 'PlanDowngraded'
  | 'PaymentMethodRestricted'
  // Marketing / A/B Testing events
  | 'ABExperimentStarted'
  | 'ABVariantAssigned'
  | 'ConversionTracked'
  | 'LandingRankUpdated'
  | 'AIExperimentSuggestionGenerated'
  // Landing Page Governance events
  | 'LandingPageSubmitted'
  | 'LandingPageApproved'
  | 'LandingPageRejected'
  | 'LandingPagePublished';

export interface PlatformEventPayload {
  type: PlatformEventType;
  timestamp: string;
  /** Platform user who performed the action */
  actorId: string;
  actorEmail?: string;
  /** Target entity */
  targetType: 'platform_user' | 'tenant' | 'platform_role' | 'cognitive_layer' | 'billing' | 'marketing' | 'governance';
  targetId: string;
  /** Extra context */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════
// Client-Side Event Bus
// ═══════════════════════════════════

type PlatformEventListener = (event: PlatformEventPayload) => void;

const listeners = new Set<PlatformEventListener>();
const eventLog: PlatformEventPayload[] = [];
const MAX_LOG = 200;

export function onPlatformEvent(listener: PlatformEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlatformEventLog(limit = 50): readonly PlatformEventPayload[] {
  return eventLog.slice(-limit);
}

// ═══════════════════════════════════
// Core Emitter
// ═══════════════════════════════════

function emit(event: PlatformEventPayload): void {
  // Log locally
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.splice(0, eventLog.length - MAX_LOG);

  console.info(`[PlatformEvent] ${event.type}`, {
    actor: event.actorId,
    target: `${event.targetType}:${event.targetId}`,
    metadata: event.metadata,
  });

  // Persist to security_logs (fire-and-forget)
  supabase.from('security_logs').insert({
    user_id: event.actorId,
    tenant_id: null, // platform events are tenant-agnostic
    action: event.type,
    resource: `${event.targetType}:${event.targetId}`,
    result: 'success',
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }).then(({ error }) => {
    if (error) console.error('[PlatformEvent] Persist failed:', error.message);
  });

  // Notify listeners
  listeners.forEach(fn => {
    try { fn(event); } catch (err) { console.error('[PlatformEvent] Listener error:', err); }
  });
}

// ═══════════════════════════════════
// Convenience Emitters
// ═══════════════════════════════════

export const platformEvents = {
  userLoggedIn(actorId: string, actorEmail?: string) {
    emit({
      type: 'PlatformUserLoggedIn',
      timestamp: new Date().toISOString(),
      actorId,
      actorEmail,
      targetType: 'platform_user',
      targetId: actorId,
    });
  },

  tenantCreated(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantCreated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  tenantSuspended(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantSuspended',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  tenantReactivated(actorId: string, tenantId: string, tenantName: string) {
    emit({
      type: 'TenantReactivated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { tenantName },
    });
  },

  permissionChanged(actorId: string, targetUserId: string, opts: { oldRole?: string; newRole?: string; action: string }) {
    emit({
      type: 'PlatformPermissionChanged',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'platform_role',
      targetId: targetUserId,
      metadata: opts,
    });
  },

  // ═══════════════════════════════════
  // Cognitive Layer Events
  // ═══════════════════════════════════

  /**
   * Emitted when user behavioral metadata is tracked (navigation, module use).
   * PRIVACY: only contains route/module keys — never PII.
   */
  userBehaviorTracked(actorId: string, opts: { route: string; eventType: string; moduleId?: string }) {
    emit({
      type: 'UserBehaviorTracked',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'cognitive_layer',
      targetId: 'behavior',
      metadata: { route: opts.route, eventType: opts.eventType, moduleId: opts.moduleId },
    });
  },

  /**
   * Emitted when the cognitive layer generates role suggestions from behavior patterns.
   */
  roleSuggestionGenerated(actorId: string, opts: { suggestedRoles: string[]; confidence: number[]; signalCount: number }) {
    emit({
      type: 'RoleSuggestionGenerated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'cognitive_layer',
      targetId: 'role_suggestion',
      metadata: opts,
    });
  },

  /**
   * Emitted when a permission risk is detected (excessive access, sensitive combos).
   */
  permissionRiskDetected(actorId: string, opts: { riskType: string; role: string; details: string; severity: 'low' | 'medium' | 'high' }) {
    emit({
      type: 'PermissionRiskDetected',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'cognitive_layer',
      targetId: `risk:${opts.role}`,
      metadata: opts,
    });
  },

  /**
   * Emitted when a navigation hint/shortcut is created from AI suggestions.
   */
  navigationHintCreated(actorId: string, opts: { route: string; label: string; source: 'ai' | 'behavior' | 'manual' }) {
    emit({
      type: 'NavigationHintCreated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'cognitive_layer',
      targetId: `hint:${opts.route}`,
      metadata: opts,
    });
  },

  // ═══════════════════════════════════
  // Billing Events
  // ═══════════════════════════════════

  /**
   * Emitted when a plan is first assigned to a tenant.
   */
  planAssignedToTenant(actorId: string, tenantId: string, opts: { planId: string; planName: string; tier: string; billingCycle: string }) {
    emit({
      type: 'PlanAssignedToTenant',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'billing',
      targetId: tenantId,
      metadata: opts,
    });
  },

  /**
   * Emitted when a tenant upgrades to a higher plan tier.
   */
  planUpgraded(actorId: string, tenantId: string, opts: { fromPlan: string; toPlan: string; fromTier: string; toTier: string; proratedAmountBrl?: number }) {
    emit({
      type: 'PlanUpgraded',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'billing',
      targetId: tenantId,
      metadata: opts,
    });
  },

  /**
   * Emitted when a tenant downgrades to a lower plan tier.
   */
  planDowngraded(actorId: string, tenantId: string, opts: { fromPlan: string; toPlan: string; fromTier: string; toTier: string; effectiveAt?: string }) {
    emit({
      type: 'PlanDowngraded',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'billing',
      targetId: tenantId,
      metadata: opts,
    });
  },

  /**
   * Emitted when a payment method is restricted or rejected for a tenant.
   */
  paymentMethodRestricted(actorId: string, tenantId: string, opts: { method: string; reason: string; allowedMethods: string[] }) {
    emit({
      type: 'PaymentMethodRestricted',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'billing',
      targetId: tenantId,
      metadata: opts,
    });
  },

  // ═══════════════════════════════════
  // Marketing / A/B Testing Events
  // ═══════════════════════════════════

  /** Emitted when an A/B experiment is started. */
  abExperimentStarted(actorId: string, opts: { experimentId: string; experimentName: string; landingPageId: string; variantCount: number }) {
    emit({
      type: 'ABExperimentStarted',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'marketing',
      targetId: opts.experimentId,
      metadata: opts,
    });
  },

  /** Emitted when a visitor is assigned to an A/B variant. */
  abVariantAssigned(actorId: string, opts: { experimentId: string; variantId: string; variantName: string; isControl: boolean }) {
    emit({
      type: 'ABVariantAssigned',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'marketing',
      targetId: opts.variantId,
      metadata: opts,
    });
  },

  /** Emitted when a conversion is recorded for an experiment variant. */
  conversionTracked(actorId: string, opts: { experimentId: string; variantId: string; metric: string; value?: number }) {
    emit({
      type: 'ConversionTracked',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'marketing',
      targetId: opts.experimentId,
      metadata: opts,
    });
  },

  /** Emitted when the landing page ranking is recalculated. */
  landingRankUpdated(actorId: string, opts: { landingPageId: string; previousRank?: number; newRank: number; metric: string }) {
    emit({
      type: 'LandingRankUpdated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'marketing',
      targetId: opts.landingPageId,
      metadata: opts,
    });
  },

  /** Emitted when AI generates a suggestion for an experiment (new variant, early stop, etc.). */
  aiExperimentSuggestionGenerated(actorId: string, opts: { experimentId: string; suggestionType: string; suggestion: string; confidence: number }) {
    emit({
      type: 'AIExperimentSuggestionGenerated',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'marketing',
      targetId: opts.experimentId,
      metadata: opts,
    });
  },

  // ═══════════════════════════════════
  // Landing Page Governance Events
  // ═══════════════════════════════════

  landingPageSubmitted(actorId: string, opts: { landingPageId: string; requestId: string; pageName: string; version: number }) {
    emit({
      type: 'LandingPageSubmitted',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'governance',
      targetId: opts.requestId,
      metadata: opts,
    });
  },

  landingPageApproved(actorId: string, opts: { landingPageId: string; requestId: string; approvedBy: string }) {
    emit({
      type: 'LandingPageApproved',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'governance',
      targetId: opts.requestId,
      metadata: opts,
    });
  },

  landingPageRejected(actorId: string, opts: { landingPageId: string; requestId: string; rejectedBy: string; reason: string }) {
    emit({
      type: 'LandingPageRejected',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'governance',
      targetId: opts.requestId,
      metadata: opts,
    });
  },

  landingPagePublished(actorId: string, opts: { landingPageId: string; requestId: string; publishedBy: string; version: number }) {
    emit({
      type: 'LandingPagePublished',
      timestamp: new Date().toISOString(),
      actorId,
      targetType: 'governance',
      targetId: opts.requestId,
      metadata: opts,
    });
  },
};

export const __DOMAIN_CATALOG = {
  domain: 'Platform Cognitive',
  color: 'hsl(270 50% 50%)',
  events: [
    { name: 'PlatformUserLoggedIn', description: 'Login de usuário na plataforma' },
    { name: 'TenantReactivated', description: 'Tenant reativado' },
    { name: 'PlatformPermissionChanged', description: 'Permissão de plataforma alterada' },
    { name: 'UserBehaviorTracked', description: 'Comportamento do usuário rastreado' },
    { name: 'RoleSuggestionGenerated', description: 'Sugestão de role gerada por IA' },
    { name: 'PermissionRiskDetected', description: 'Risco de permissão detectado' },
    { name: 'NavigationHintCreated', description: 'Dica de navegação criada' },
    { name: 'PlanAssignedToTenant', description: 'Plano atribuído ao tenant' },
    { name: 'PlanUpgraded', description: 'Plano atualizado (upgrade)' },
    { name: 'PlanDowngraded', description: 'Plano rebaixado (downgrade)' },
    { name: 'PaymentMethodRestricted', description: 'Método de pagamento restrito' },
    { name: 'ABExperimentStarted', description: 'Experimento A/B iniciado' },
    { name: 'ABVariantAssigned', description: 'Variante A/B atribuída ao visitante' },
    { name: 'LandingRankUpdated', description: 'Ranking de landing page atualizado' },
    { name: 'AIExperimentSuggestionGenerated', description: 'Sugestão de experimento gerada por IA' },
    { name: 'LandingPageSubmitted', description: 'Landing page submetida para aprovação' },
    { name: 'LandingPageApproved', description: 'Landing page aprovada pela governança' },
    { name: 'LandingPageRejected', description: 'Landing page rejeitada pela governança' },
  ],
};
