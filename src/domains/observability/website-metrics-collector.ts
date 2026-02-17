/**
 * WebsiteMetricsCollector — Prometheus-compatible metrics for website builder.
 *
 * Exports:
 *   website_seo_score              (gauge,   labels: page)
 *   mobile_performance_index       (gauge,   labels: page)
 *   compliance_warnings_total      (counter, labels: page, severity)
 *   website_publish_total          (counter, labels: page, version)
 *
 * All metrics are automatically available in the Grafana adapter via
 * the shared MetricsCollector singleton.
 */
import { getMetricsCollector } from './metrics-collector';

// ── Recording helpers ───────────────────────────────────────────

/** Update the SEO score gauge for a page (0-100). */
export function recordSEOScore(page: string, score: number) {
  getMetricsCollector().gauge('website_seo_score', score, { page });
}

/** Update the mobile performance index gauge for a page (0-100). */
export function recordMobilePerformance(page: string, score: number) {
  getMetricsCollector().gauge('mobile_performance_index', score, { page });
}

/** Increment compliance warnings counter. */
export function recordComplianceWarning(page: string, severity: 'error' | 'warning' | 'info') {
  getMetricsCollector().increment('compliance_warnings_total', { page, severity });
}

/** Increment website publish counter. */
export function recordWebsitePublish(page: string, version: string) {
  getMetricsCollector().increment('website_publish_total', { page, version });
}

// ── Snapshot (for dashboard widgets / Grafana panels) ───────────

export interface WebsiteMetricsSnapshot {
  seoScores: Array<{ page: string; score: number }>;
  mobileScores: Array<{ page: string; score: number }>;
  complianceWarnings: number;
  publishCount: number;
  timestamp: number;
}

export function collectWebsiteMetrics(): WebsiteMetricsSnapshot {
  const collector = getMetricsCollector();
  const all = collector.getPoints();

  const seoScores: Array<{ page: string; score: number }> = [];
  const mobileScores: Array<{ page: string; score: number }> = [];
  let complianceWarnings = 0;
  let publishCount = 0;

  for (const point of all) {
    if (point.name === 'website_seo_score') {
      seoScores.push({ page: point.labels?.page ?? 'unknown', score: point.value });
    }
    if (point.name === 'mobile_performance_index') {
      mobileScores.push({ page: point.labels?.page ?? 'unknown', score: point.value });
    }
    if (point.name === 'compliance_warnings_total') {
      complianceWarnings += point.value;
    }
    if (point.name === 'website_publish_total') {
      publishCount += point.value;
    }
  }

  return {
    seoScores,
    mobileScores,
    complianceWarnings,
    publishCount,
    timestamp: Date.now(),
  };
}

// ── Prometheus text block (appended by grafana adapter) ─────────

export function websiteMetricsToPrometheus(): string {
  const snap = collectWebsiteMetrics();
  const lines: string[] = [];

  lines.push('# HELP website_seo_score SEO score for each website page (0-100)');
  lines.push('# TYPE website_seo_score gauge');
  for (const s of snap.seoScores) {
    lines.push(`website_seo_score{page="${s.page}"} ${s.score}`);
  }

  lines.push('# HELP mobile_performance_index Mobile performance score per page (0-100)');
  lines.push('# TYPE mobile_performance_index gauge');
  for (const m of snap.mobileScores) {
    lines.push(`mobile_performance_index{page="${m.page}"} ${m.score}`);
  }

  lines.push('# HELP compliance_warnings_total Total compliance warnings detected');
  lines.push('# TYPE compliance_warnings_total counter');
  lines.push(`compliance_warnings_total ${snap.complianceWarnings}`);

  lines.push('# HELP website_publish_total Total website page publishes');
  lines.push('# TYPE website_publish_total counter');
  lines.push(`website_publish_total ${snap.publishCount}`);

  return lines.join('\n');
}
