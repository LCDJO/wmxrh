/**
 * BillingDomainEvents — Event bus for billing domain.
 *
 * Events:
 *  - TenantPlanAssigned
 *  - TenantPlanUpgraded
 *  - InvoiceGenerated
 *  - RevenueUpdated
 */

// ── Event Types ─────────────────────────────────────────────────

export type BillingEventType =
  | 'TenantPlanAssigned'
  | 'TenantPlanUpgraded'
  | 'InvoiceGenerated'
  | 'RevenueUpdated';

export interface BillingEventBase {
  type: BillingEventType;
  timestamp: number;
  tenant_id: string;
  metadata?: Record<string, unknown>;
}

export interface TenantPlanAssignedEvent extends BillingEventBase {
  type: 'TenantPlanAssigned';
  plan_id: string;
  billing_cycle: string;
}

export interface TenantPlanUpgradedEvent extends BillingEventBase {
  type: 'TenantPlanUpgraded';
  from_plan_id: string;
  to_plan_id: string;
  proration_amount: number;
}

export interface InvoiceGeneratedEvent extends BillingEventBase {
  type: 'InvoiceGenerated';
  invoice_id: string;
  total_amount: number;
  due_date: string;
  notes?: string;
}

export interface RevenueUpdatedEvent extends BillingEventBase {
  type: 'RevenueUpdated';
  invoice_id: string;
  amount: number;
  entry_type: 'charge' | 'payment' | 'refund' | 'adjustment';
}

export type BillingDomainEvent =
  | TenantPlanAssignedEvent
  | TenantPlanUpgradedEvent
  | InvoiceGeneratedEvent
  | RevenueUpdatedEvent;

// ── Event Bus ───────────────────────────────────────────────────

type BillingEventListener<T extends BillingDomainEvent = BillingDomainEvent> = (event: T) => void;

const globalListeners = new Set<BillingEventListener>();
const typedListeners = new Map<BillingEventType, Set<BillingEventListener<any>>>();

/** Subscribe to all billing events. */
export function onBillingEvent(listener: BillingEventListener): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}

/** Subscribe to a specific billing event type. */
export function onBillingEventType<T extends BillingDomainEvent>(
  type: T['type'],
  listener: BillingEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => typedListeners.get(type)?.delete(listener);
}

/** Emit a billing domain event. */
export function emitBillingEvent(event: BillingDomainEvent): void {
  // Global listeners
  for (const l of globalListeners) {
    try { l(event); } catch (e) { console.error('[BillingEvents] listener error', e); }
  }
  // Typed listeners
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch (e) { console.error('[BillingEvents] typed listener error', e); }
    }
  }
  // Append to log
  appendToLog(event);
}

// ── Event Log (for audit / debugging) ───────────────────────────

const MAX_LOG = 100;
const eventLog: BillingDomainEvent[] = [];

function appendToLog(event: BillingDomainEvent) {
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.splice(0, eventLog.length - MAX_LOG);
}

export function getBillingEventLog(): ReadonlyArray<BillingDomainEvent> {
  return eventLog;
}

export function clearBillingEventLog(): void {
  eventLog.length = 0;
}
