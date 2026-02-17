/**
 * PerformanceComparator — Compares conversion metrics between two version snapshots.
 *
 * Compares: Versão atual vs versão anterior
 * Alerts when: conversion_rate_drop > threshold OR revenue_drop > threshold
 *
 * Configurable via RollbackPolicy:
 *  - min_sample_size
 *  - drop_percentage_threshold
 *  - observation_window_minutes
 */
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import { emitGrowthEvent } from '../growth.events';
import type { ConversionSnapshot, PerformanceComparison, RollbackThresholds } from './types';
import { DEFAULT_ROLLBACK_THRESHOLDS } from './types';

// ── RollbackPolicy ──────────────────────────────────

export interface RollbackPolicy {
  /** Minimum impressions before comparison is valid */
  min_sample_size: number;
  /** Drop percentage that triggers alert (applies to conversion_rate AND revenue) */
  drop_percentage_threshold: number;
  /** Minutes after publish before monitoring begins */
  observation_window_minutes: number;
}

export const DEFAULT_ROLLBACK_POLICY: RollbackPolicy = {
  min_sample_size: 100,
  drop_percentage_threshold: 20,
  observation_window_minutes: 30,
};

// ── Alert ────────────────────────────────────────────

export type PerformanceAlertSeverity = 'warning' | 'critical';

export interface PerformanceAlert {
  id: string;
  landingPageId: string;
  currentVersionNumber: number;
  previousVersionNumber: number;
  severity: PerformanceAlertSeverity;
  triggers: PerformanceAlertTrigger[];
  comparison: PerformanceComparison;
  policy: RollbackPolicy;
  createdAt: string;
  acknowledged: boolean;
}

export interface PerformanceAlertTrigger {
  metric: 'conversion_rate' | 'revenue' | 'bounce_rate' | 'cta_click_rate' | 'signup_rate';
  currentValue: number;
  previousValue: number;
  dropPct: number;
  threshold: number;
}

// ── Comparator ───────────────────────────────────────

class PerformanceComparator {
  private alerts: PerformanceAlert[] = [];
  private policies = new Map<string, RollbackPolicy>();

  // ── Policy Management ──

  /**
   * Set a custom RollbackPolicy for a landing page (overrides defaults).
   */
  setPolicy(landingPageId: string, policy: Partial<RollbackPolicy>): RollbackPolicy {
    const merged: RollbackPolicy = { ...DEFAULT_ROLLBACK_POLICY, ...policy };
    this.policies.set(landingPageId, merged);
    return merged;
  }

  getPolicy(landingPageId: string): RollbackPolicy {
    return this.policies.get(landingPageId) ?? DEFAULT_ROLLBACK_POLICY;
  }

  // ── Core Comparison ──

  /**
   * Compare current version metrics against a previous version baseline.
   * Generates alerts when degradation exceeds policy thresholds.
   */
  compare(
    current: ConversionSnapshot,
    previous: ConversionSnapshot,
    thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS,
  ): PerformanceComparison {
    const policy = this.getPolicy(current.landingPageId);

    const conversionRateDelta = this.relativeDelta(current.conversionRate, previous.conversionRate);
    const revenueDelta = this.relativeDelta(current.revenue, previous.revenue);
    const bounceRateDelta = this.relativeDelta(current.bounceRate, previous.bounceRate);

    // Indicator-level deltas
    const ctaClickRateDelta = current.indicators && previous.indicators
      ? this.relativeDelta(current.indicators.cta_click_rate, previous.indicators.cta_click_rate)
      : 0;
    const signupRateDelta = current.indicators && previous.indicators
      ? this.relativeDelta(current.indicators.signup_rate, previous.indicators.signup_rate)
      : 0;

    // Sample sufficiency determines confidence
    const effectiveSampleSize = Math.max(policy.min_sample_size, thresholds.minimumSampleSize);
    const sampleSufficiency = Math.min(current.impressions / effectiveSampleSize, 1);
    const confidence = Math.round(sampleSufficiency * 100);

    // Degradation check using policy threshold
    const dropThreshold = policy.drop_percentage_threshold;
    const isDegraded =
      (conversionRateDelta <= -dropThreshold) ||
      (revenueDelta <= -dropThreshold) ||
      (bounceRateDelta >= thresholds.bounceRateIncreaseThreshold);

    const comparison: PerformanceComparison = {
      currentVersion: current,
      previousVersion: previous,
      conversionRateDelta: this.round2(conversionRateDelta),
      revenueDelta: this.round2(revenueDelta),
      bounceRateDelta: this.round2(bounceRateDelta),
      isDegraded,
      confidence,
      comparedAt: new Date().toISOString(),
    };

    // Generate alert if degradation detected and sample is sufficient
    if (isDegraded && sampleSufficiency >= 0.5) {
      this.generateAlert(current, previous, comparison, policy, {
        conversionRateDelta,
        revenueDelta,
        bounceRateDelta,
        ctaClickRateDelta,
        signupRateDelta,
      });
    }

    // Prometheus
    const mc = getMetricsCollector();
    const labels = { landing_page_id: current.landingPageId };
    mc.gauge('landing_performance_conversion_delta', conversionRateDelta, labels);
    mc.gauge('landing_performance_revenue_delta', revenueDelta, labels);
    mc.gauge('landing_performance_confidence', confidence, labels);

    return comparison;
  }

  // ── Alert Management ──

  getAlerts(landingPageId?: string): PerformanceAlert[] {
    if (!landingPageId) return [...this.alerts];
    return this.alerts.filter(a => a.landingPageId === landingPageId);
  }

  getUnacknowledgedAlerts(landingPageId?: string): PerformanceAlert[] {
    return this.getAlerts(landingPageId).filter(a => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  // ── Internals ──

  private generateAlert(
    current: ConversionSnapshot,
    previous: ConversionSnapshot,
    comparison: PerformanceComparison,
    policy: RollbackPolicy,
    deltas: Record<string, number>,
  ): PerformanceAlert {
    const triggers: PerformanceAlertTrigger[] = [];
    const threshold = policy.drop_percentage_threshold;

    if (deltas.conversionRateDelta <= -threshold) {
      triggers.push({
        metric: 'conversion_rate',
        currentValue: current.conversionRate,
        previousValue: previous.conversionRate,
        dropPct: this.round2(Math.abs(deltas.conversionRateDelta)),
        threshold,
      });
    }

    if (deltas.revenueDelta <= -threshold) {
      triggers.push({
        metric: 'revenue',
        currentValue: current.revenue,
        previousValue: previous.revenue,
        dropPct: this.round2(Math.abs(deltas.revenueDelta)),
        threshold,
      });
    }

    if (deltas.bounceRateDelta >= threshold) {
      triggers.push({
        metric: 'bounce_rate',
        currentValue: current.bounceRate,
        previousValue: previous.bounceRate,
        dropPct: this.round2(deltas.bounceRateDelta),
        threshold,
      });
    }

    if (deltas.ctaClickRateDelta <= -threshold) {
      triggers.push({
        metric: 'cta_click_rate',
        currentValue: current.indicators?.cta_click_rate ?? 0,
        previousValue: previous.indicators?.cta_click_rate ?? 0,
        dropPct: this.round2(Math.abs(deltas.ctaClickRateDelta)),
        threshold,
      });
    }

    if (deltas.signupRateDelta <= -threshold) {
      triggers.push({
        metric: 'signup_rate',
        currentValue: current.indicators?.signup_rate ?? 0,
        previousValue: previous.indicators?.signup_rate ?? 0,
        dropPct: this.round2(Math.abs(deltas.signupRateDelta)),
        threshold,
      });
    }

    // Severity: critical if multiple triggers or any drop > 2x threshold
    const severity: PerformanceAlertSeverity =
      triggers.length >= 2 || triggers.some(t => t.dropPct > threshold * 2)
        ? 'critical'
        : 'warning';

    const alert: PerformanceAlert = {
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      landingPageId: current.landingPageId,
      currentVersionNumber: current.versionNumber,
      previousVersionNumber: previous.versionNumber,
      severity,
      triggers,
      comparison,
      policy,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Emit growth insight event
    emitGrowthEvent({
      type: 'GrowthInsightGenerated',
      timestamp: Date.now(),
      insightId: alert.id,
      category: 'performance_degradation',
      severity: severity === 'critical' ? 'critical' : 'warning',
      pageId: current.landingPageId,
      pageName: '',
      title: `Queda de performance v${current.versionNumber} vs v${previous.versionNumber}: ${triggers.map(t => t.metric).join(', ')}`,
    });

    // Prometheus counter
    getMetricsCollector().increment('landing_performance_alert_total', {
      landing_page_id: current.landingPageId,
      severity,
    });

    console.warn(
      `[PerformanceComparator] ALERT (${severity}): LP ${current.landingPageId} ` +
      `v${current.versionNumber} — ${triggers.map(t => `${t.metric} -${t.dropPct}%`).join(', ')}`,
    );

    return alert;
  }

  private relativeDelta(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}

export const performanceComparator = new PerformanceComparator();
export { PerformanceComparator };
