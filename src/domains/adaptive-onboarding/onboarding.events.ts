/**
 * Onboarding Domain Events
 *
 * Events emitted during the adaptive onboarding lifecycle:
 *
 *   TenantOnboardingStarted    — When a tenant begins initial onboarding
 *   OnboardingStepCompleted    — When any onboarding step is completed
 *   OnboardingStepSkipped      — When a step is explicitly skipped
 *   OnboardingFinished         — When onboarding reaches 100%
 *   RoleBootstrapCompleted     — When initial roles are created via wizard
 *
 * Consumers: AuditLog, eSocial EventGenerator, PXE, Analytics
 */

// ── Event types ─────────────────────────────────────────────────

export type OnboardingEventType =
  | 'TenantOnboardingStarted'
  | 'OnboardingStepCompleted'
  | 'OnboardingStepSkipped'
  | 'OnboardingFinished'
  | 'RoleBootstrapCompleted';

// ── Payloads ────────────────────────────────────────────────────

export interface OnboardingEventBase {
  type: OnboardingEventType;
  tenant_id: string;
  user_id: string;
  timestamp: number;
}

export interface TenantOnboardingStartedEvent extends OnboardingEventBase {
  type: 'TenantOnboardingStarted';
  metadata: {
    plan_tier: string;
    total_steps: number;
    estimated_minutes: number;
  };
}

export interface OnboardingStepCompletedEvent extends OnboardingEventBase {
  type: 'OnboardingStepCompleted';
  metadata: {
    step_id: string;
    step_title: string;
    phase: string;
    completion_pct: number;
    elapsed_ms: number;
  };
}

export interface OnboardingStepSkippedEvent extends OnboardingEventBase {
  type: 'OnboardingStepSkipped';
  metadata: {
    step_id: string;
    step_title: string;
    phase: string;
    completion_pct: number;
  };
}

export interface OnboardingFinishedEvent extends OnboardingEventBase {
  type: 'OnboardingFinished';
  metadata: {
    total_steps: number;
    completed_steps: number;
    skipped_steps: number;
    total_elapsed_ms: number;
    plan_tier: string;
  };
}

export interface RoleBootstrapCompletedEvent extends OnboardingEventBase {
  type: 'RoleBootstrapCompleted';
  metadata: {
    roles_created: string[];
    plan_tier: string;
  };
}

// ── Union ───────────────────────────────────────────────────────

export type OnboardingDomainEvent =
  | TenantOnboardingStartedEvent
  | OnboardingStepCompletedEvent
  | OnboardingStepSkippedEvent
  | OnboardingFinishedEvent
  | RoleBootstrapCompletedEvent;

// ── Event Bus ───────────────────────────────────────────────────

type EventHandler<T extends OnboardingDomainEvent = OnboardingDomainEvent> = (event: T) => void;

const globalListeners = new Set<EventHandler>();
const typedListeners = new Map<OnboardingEventType, Set<EventHandler>>();

const MAX_LOG = 200;
const eventLog: OnboardingDomainEvent[] = [];

/** Subscribe to ALL onboarding events. */
export function onOnboardingEvent(handler: EventHandler): () => void {
  globalListeners.add(handler);
  return () => { globalListeners.delete(handler); };
}

/** Subscribe to a specific onboarding event type. */
export function onOnboardingEventType<T extends OnboardingDomainEvent>(
  type: T['type'],
  handler: EventHandler<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  const set = typedListeners.get(type)!;
  set.add(handler as EventHandler);
  return () => { set.delete(handler as EventHandler); };
}

/** Emit an onboarding domain event. */
export function emitOnboardingEvent(event: OnboardingDomainEvent): void {
  // Log
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.shift();

  // Notify global listeners
  for (const h of globalListeners) {
    try { h(event); } catch (e) { console.error('[OnboardingEvents]', e); }
  }

  // Notify typed listeners
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const h of typed) {
      try { h(event); } catch (e) { console.error('[OnboardingEvents]', e); }
    }
  }
}

/** Get the event log (readonly). */
export function getOnboardingEventLog(): ReadonlyArray<OnboardingDomainEvent> {
  return eventLog;
}

/** Clear the event log (testing). */
export function clearOnboardingEventLog(): void {
  eventLog.length = 0;
}

// ── Convenience emitters ────────────────────────────────────────

export function emitTenantOnboardingStarted(
  tenantId: string,
  userId: string,
  meta: TenantOnboardingStartedEvent['metadata'],
): void {
  emitOnboardingEvent({
    type: 'TenantOnboardingStarted',
    tenant_id: tenantId,
    user_id: userId,
    timestamp: Date.now(),
    metadata: meta,
  });
}

export function emitOnboardingStepCompleted(
  tenantId: string,
  userId: string,
  meta: OnboardingStepCompletedEvent['metadata'],
): void {
  emitOnboardingEvent({
    type: 'OnboardingStepCompleted',
    tenant_id: tenantId,
    user_id: userId,
    timestamp: Date.now(),
    metadata: meta,
  });
}

export function emitOnboardingStepSkipped(
  tenantId: string,
  userId: string,
  meta: OnboardingStepSkippedEvent['metadata'],
): void {
  emitOnboardingEvent({
    type: 'OnboardingStepSkipped',
    tenant_id: tenantId,
    user_id: userId,
    timestamp: Date.now(),
    metadata: meta,
  });
}

export function emitOnboardingFinished(
  tenantId: string,
  userId: string,
  meta: OnboardingFinishedEvent['metadata'],
): void {
  emitOnboardingEvent({
    type: 'OnboardingFinished',
    tenant_id: tenantId,
    user_id: userId,
    timestamp: Date.now(),
    metadata: meta,
  });
}

export function emitRoleBootstrapCompleted(
  tenantId: string,
  userId: string,
  meta: RoleBootstrapCompletedEvent['metadata'],
): void {
  emitOnboardingEvent({
    type: 'RoleBootstrapCompleted',
    tenant_id: tenantId,
    user_id: userId,
    timestamp: Date.now(),
    metadata: meta,
  });
}

export const __DOMAIN_CATALOG = {
  domain: 'Onboarding',
  color: 'hsl(175 60% 45%)',
  events: [
    { name: 'TenantOnboardingStarted', description: 'Onboarding do tenant iniciado' },
    { name: 'OnboardingStepCompleted', description: 'Etapa de onboarding concluída' },
    { name: 'OnboardingStepSkipped', description: 'Etapa de onboarding ignorada' },
    { name: 'OnboardingFinished', description: 'Onboarding finalizado' },
    { name: 'RoleBootstrapCompleted', description: 'Bootstrap de roles concluído' },
  ],
};
