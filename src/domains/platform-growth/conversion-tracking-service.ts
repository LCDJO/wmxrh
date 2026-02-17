/**
 * ConversionTrackingService — Tracks and aggregates conversion events from landing pages.
 * Connects to Revenue Intelligence, Referral Engine, and Billing Core.
 */
import type { ConversionEvent } from './types';

export class ConversionTrackingService {
  private events: ConversionEvent[] = [
    { id: 'ce-1', landingPageId: 'lp-1', type: 'signup', source: 'google', trackedAt: '2026-02-16T10:00:00Z', metadata: {} },
    { id: 'ce-2', landingPageId: 'lp-1', type: 'trial_start', source: 'referral', referralCode: 'REF-ABC', trackedAt: '2026-02-16T11:30:00Z', metadata: {} },
    { id: 'ce-3', landingPageId: 'lp-1', type: 'tenant_created', source: 'referral', referralCode: 'REF-ABC', tenantId: 't-5', trackedAt: '2026-02-16T12:00:00Z', metadata: {} },
    { id: 'ce-4', landingPageId: 'lp-1', type: 'plan_selected', source: 'referral', referralCode: 'REF-ABC', tenantId: 't-5', planSelected: 'professional', trackedAt: '2026-02-16T13:00:00Z', metadata: {} },
    { id: 'ce-5', landingPageId: 'lp-1', type: 'revenue_generated', source: 'referral', referralCode: 'REF-ABC', tenantId: 't-5', revenue: 499, trackedAt: '2026-02-16T14:00:00Z', metadata: {} },
    { id: 'ce-6', landingPageId: 'lp-1', type: 'referral_click', source: 'email', referralCode: 'REF-XYZ', trackedAt: '2026-02-17T09:00:00Z', metadata: {} },
  ];

  track(event: Omit<ConversionEvent, 'id' | 'trackedAt'>): ConversionEvent {
    const tracked: ConversionEvent = {
      ...event,
      id: `ce-${Date.now()}`,
      trackedAt: new Date().toISOString(),
    };
    this.events.push(tracked);
    return tracked;
  }

  getByPage(pageId: string): ConversionEvent[] {
    return this.events.filter(e => e.landingPageId === pageId);
  }

  getAll(): ConversionEvent[] {
    return [...this.events];
  }

  getConversionFunnel(pageId: string) {
    const pageEvents = this.getByPage(pageId);
    return {
      views: 4820,
      signups: pageEvents.filter(e => e.type === 'signup').length,
      trials: pageEvents.filter(e => e.type === 'trial_start').length,
      tenantsCreated: pageEvents.filter(e => e.type === 'tenant_created').length,
      plansSelected: pageEvents.filter(e => e.type === 'plan_selected').length,
      revenueEvents: pageEvents.filter(e => e.type === 'revenue_generated').length,
      referralClicks: pageEvents.filter(e => e.type === 'referral_click').length,
      totalRevenue: pageEvents.reduce((sum, e) => sum + (e.revenue ?? 0), 0),
    };
  }
}

export const conversionTrackingService = new ConversionTrackingService();
