/**
 * PerformanceComparator — Compares conversion metrics between two version snapshots.
 *
 * Calculates relative deltas and determines if degradation exceeds thresholds.
 */
import type { ConversionSnapshot, PerformanceComparison, RollbackThresholds } from './types';
import { DEFAULT_ROLLBACK_THRESHOLDS } from './types';

class PerformanceComparator {
  /**
   * Compare current version metrics against a previous version baseline.
   * Returns a PerformanceComparison indicating deltas and whether degradation is detected.
   */
  compare(
    current: ConversionSnapshot,
    previous: ConversionSnapshot,
    thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS,
  ): PerformanceComparison {
    const conversionRateDelta = this.relativeDelta(current.conversionRate, previous.conversionRate);
    const revenueDelta = this.relativeDelta(current.revenue, previous.revenue);
    const bounceRateDelta = this.relativeDelta(current.bounceRate, previous.bounceRate);

    // Sample sufficiency affects confidence
    const sampleSufficiency = Math.min(current.impressions / thresholds.minimumSampleSize, 1);
    const confidence = Math.round(sampleSufficiency * 100);

    // Check degradation: negative conversion delta, negative revenue delta, or positive bounce delta
    const isDegraded =
      (conversionRateDelta <= -thresholds.conversionDropThreshold) ||
      (revenueDelta <= -thresholds.revenueDropThreshold) ||
      (bounceRateDelta >= thresholds.bounceRateIncreaseThreshold);

    return {
      currentVersion: current,
      previousVersion: previous,
      conversionRateDelta: Math.round(conversionRateDelta * 100) / 100,
      revenueDelta: Math.round(revenueDelta * 100) / 100,
      bounceRateDelta: Math.round(bounceRateDelta * 100) / 100,
      isDegraded,
      confidence,
      comparedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate relative percentage change: (new - old) / old * 100
   */
  private relativeDelta(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}

export const performanceComparator = new PerformanceComparator();
export { PerformanceComparator };
