import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  emitBillingEvent,
  onBillingEvent,
  onBillingEventType,
  getBillingEventLog,
  clearBillingEventLog,
  type BillingDomainEvent,
  type UsageRecordedEvent,
  type InvoiceGeneratedEvent,
} from '@/domains/billing-core/billing-events';

function makeEvent(overrides: Partial<BillingDomainEvent> = {}): UsageRecordedEvent {
  return {
    type: 'UsageRecorded',
    timestamp: Date.now(),
    tenant_id: 'tenant-1',
    metric: 'api_calls',
    quantity: 100,
    unit: 'calls',
    ...overrides,
  } as UsageRecordedEvent;
}

describe('BillingEvents — Event Bus', () => {
  beforeEach(() => {
    clearBillingEventLog();
  });

  it('emits to global listeners', () => {
    const received: BillingDomainEvent[] = [];
    const unsub = onBillingEvent(e => received.push(e));

    emitBillingEvent(makeEvent());
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('UsageRecorded');

    unsub();
    emitBillingEvent(makeEvent());
    expect(received).toHaveLength(1); // unsubscribed
  });

  it('emits to typed listeners only for matching type', () => {
    const usageEvents: UsageRecordedEvent[] = [];
    const invoiceEvents: InvoiceGeneratedEvent[] = [];

    const unsub1 = onBillingEventType<UsageRecordedEvent>('UsageRecorded', e => usageEvents.push(e));
    const unsub2 = onBillingEventType<InvoiceGeneratedEvent>('InvoiceGenerated', e => invoiceEvents.push(e));

    emitBillingEvent(makeEvent());
    expect(usageEvents).toHaveLength(1);
    expect(invoiceEvents).toHaveLength(0);

    emitBillingEvent({
      type: 'InvoiceGenerated',
      timestamp: Date.now(),
      tenant_id: 'tenant-1',
      invoice_id: 'inv-1',
      total_amount: 500,
      due_date: '2026-03-01',
    });
    expect(invoiceEvents).toHaveLength(1);
    expect(usageEvents).toHaveLength(1);

    unsub1();
    unsub2();
  });

  it('appends to event log and respects MAX_LOG', () => {
    for (let i = 0; i < 110; i++) {
      emitBillingEvent(makeEvent({ metric: `m-${i}` } as any));
    }
    const log = getBillingEventLog();
    expect(log.length).toBeLessThanOrEqual(100);
  });

  it('clearBillingEventLog resets the log', () => {
    emitBillingEvent(makeEvent());
    expect(getBillingEventLog().length).toBeGreaterThan(0);
    clearBillingEventLog();
    expect(getBillingEventLog()).toHaveLength(0);
  });

  it('listener errors do not break event propagation', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good: BillingDomainEvent[] = [];

    const unsub1 = onBillingEvent(() => { throw new Error('boom'); });
    const unsub2 = onBillingEvent(e => good.push(e));

    emitBillingEvent(makeEvent());
    expect(good).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalled();

    unsub1();
    unsub2();
    consoleSpy.mockRestore();
  });
});
