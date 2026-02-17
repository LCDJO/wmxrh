/**
 * ConversionMonitor — Monitors real-time conversion metrics per landing page version.
 *
 * Collects snapshots of conversion rate, revenue, and bounce rate
 * for the currently published version and caches historical snapshots.
 */
import { conversionTrackingService } from '../conversion-tracking-service';
import type { ConversionSnapshot } from './types';

class ConversionMonitor {
  private snapshots = new Map<string, ConversionSnapshot[]>();
  private readonly MAX_SNAPSHOTS_PER_PAGE = 50;

  /**
   * Capture a conversion snapshot for a landing page version.
   */
  capture(landingPageId: string, versionId: string, versionNumber: number): ConversionSnapshot {
    const funnel = conversionTrackingService.getConversionFunnel(landingPageId);

    const impressions = funnel.views || 1;
    const conversions = funnel.signups + funnel.trials + funnel.plansSelected;
    const conversionRate = impressions > 0
      ? Math.round((conversions / impressions) * 10000) / 100
      : 0;
    const bounceRate = impressions > 0
      ? Math.round(((impressions - conversions) / impressions) * 10000) / 100
      : 0;

    const snapshot: ConversionSnapshot = {
      landingPageId,
      versionId,
      versionNumber,
      conversionRate,
      conversions,
      impressions,
      revenue: funnel.totalRevenue,
      bounceRate,
      capturedAt: new Date().toISOString(),
    };

    this.store(landingPageId, snapshot);
    return snapshot;
  }

  /**
   * Get the latest snapshot for a landing page.
   */
  getLatest(landingPageId: string): ConversionSnapshot | null {
    const history = this.snapshots.get(landingPageId);
    return history?.[0] ?? null;
  }

  /**
   * Get snapshots for a specific version.
   */
  getByVersion(landingPageId: string, versionId: string): ConversionSnapshot[] {
    const history = this.snapshots.get(landingPageId) ?? [];
    return history.filter(s => s.versionId === versionId);
  }

  /**
   * Get all snapshots for a landing page (newest first).
   */
  getHistory(landingPageId: string): ConversionSnapshot[] {
    return this.snapshots.get(landingPageId) ?? [];
  }

  /**
   * Get the last snapshot from the previous version (before the current one).
   */
  getLastPreviousVersionSnapshot(
    landingPageId: string,
    currentVersionId: string,
  ): ConversionSnapshot | null {
    const history = this.snapshots.get(landingPageId) ?? [];
    return history.find(s => s.versionId !== currentVersionId) ?? null;
  }

  private store(landingPageId: string, snapshot: ConversionSnapshot): void {
    const history = this.snapshots.get(landingPageId) ?? [];
    history.unshift(snapshot);
    if (history.length > this.MAX_SNAPSHOTS_PER_PAGE) {
      history.length = this.MAX_SNAPSHOTS_PER_PAGE;
    }
    this.snapshots.set(landingPageId, history);
  }
}

export const conversionMonitor = new ConversionMonitor();
export { ConversionMonitor };
