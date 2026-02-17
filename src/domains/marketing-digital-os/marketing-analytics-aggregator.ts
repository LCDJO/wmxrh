/**
 * MarketingAnalyticsAggregator — Unified analytics across all marketing assets.
 *
 * Aggregates metrics from Landing Pages, Website, Experiments, and Campaigns
 * into a single analytics view for the Marketing Digital OS dashboard.
 */
import { landingPageBuilder } from '@/domains/platform-growth';
import { abTestingManager, conversionTrackingService } from '@/domains/platform-growth';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { LandingPage } from '@/domains/platform-growth/types';

// ── Types ──────────────────────────────────────────────

export interface MarketingKPIs {
  totalViews: number;
  totalUniqueVisitors: number;
  totalConversions: number;
  avgConversionRate: number;
  avgBounceRate: number;
  totalRevenue: number;
  activeExperiments: number;
  avgAIScore: number;
}

export interface AssetPerformance {
  id: string;
  name: string;
  type: 'landing_page' | 'website_page';
  views: number;
  conversions: number;
  conversionRate: number;
  aiScore: number;
  riskLevel: string;
}

export interface SourceAttribution {
  source: string;
  visits: number;
  percentage: number;
}

// ── Aggregator ─────────────────────────────────────────

export class MarketingAnalyticsAggregator {
  async getKPIs(): Promise<MarketingKPIs> {
    const pages = await landingPageBuilder.getAll();
    const experiments = abTestingManager.listByStatus('running');

    const totalViews = pages.reduce((s, p) => s + p.analytics.views, 0);
    const totalUniqueVisitors = pages.reduce((s, p) => s + p.analytics.uniqueVisitors, 0);
    const totalConversions = pages.reduce((s, p) => s + p.analytics.conversions, 0);
    const avgConversionRate = pages.length > 0
      ? Math.round((pages.reduce((s, p) => s + p.analytics.conversionRate, 0) / pages.length) * 10) / 10
      : 0;
    const avgBounceRate = pages.length > 0
      ? Math.round((pages.reduce((s, p) => s + p.analytics.bounceRate, 0) / pages.length) * 10) / 10
      : 0;

    // Revenue from conversion tracking
    const allEvents = conversionTrackingService.getAll();
    const totalRevenue = allEvents.reduce((s, e) => s + (e.revenue ?? 0), 0);

    // AI scores
    const scores = pages.map(p => growthAISupportLayer.analyzeConversionRisk(p).overallScore);
    const avgAIScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

    return {
      totalViews,
      totalUniqueVisitors,
      totalConversions,
      avgConversionRate,
      avgBounceRate,
      totalRevenue,
      activeExperiments: experiments.length,
      avgAIScore,
    };
  }

  async getAssetPerformance(): Promise<AssetPerformance[]> {
    const pages = await landingPageBuilder.getAll();

    return pages
      .map(p => {
        const risk = growthAISupportLayer.analyzeConversionRisk(p);
        return {
          id: p.id,
          name: p.name,
          type: 'landing_page' as const,
          views: p.analytics.views,
          conversions: p.analytics.conversions,
          conversionRate: p.analytics.conversionRate,
          aiScore: risk.overallScore,
          riskLevel: risk.riskLevel,
        };
      })
      .sort((a, b) => b.conversionRate - a.conversionRate);
  }

  async getSourceAttribution(): Promise<SourceAttribution[]> {
    const pages = await landingPageBuilder.getAll();
    const sourceMap = new Map<string, number>();

    for (const page of pages) {
      for (const src of page.analytics.topSources) {
        sourceMap.set(src.source, (sourceMap.get(src.source) ?? 0) + src.visits);
      }
    }

    const totalVisits = Array.from(sourceMap.values()).reduce((s, v) => s + v, 0);

    return Array.from(sourceMap.entries())
      .map(([source, visits]) => ({
        source,
        visits,
        percentage: totalVisits > 0 ? Math.round((visits / totalVisits) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.visits - a.visits);
  }
}

export const marketingAnalyticsAggregator = new MarketingAnalyticsAggregator();
