/**
 * AIConversionService — Frontend service for the AI Conversion Designer edge function.
 *
 * Gathers real-time data from 4 AI Inputs:
 *  1. Revenue Intelligence (MRR, churn, upgrade candidates)
 *  2. Referral Conversion Data (attribution, conversion rates)
 *  3. FAB Performance (scoring, completeness)
 *  4. Landing Analytics (views, conversions, bounce rate)
 *
 * Then sends enriched context to the AI edge function.
 */
import { supabase } from '@/integrations/supabase/client';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import { referralTrackingService } from './referral-tracking-service';
import { conversionTrackingService } from './conversion-tracking-service';
import { aiConversionDesigner } from './ai-conversion-designer';
import { fabContentEngine } from './landing-page-builder';
import type { LandingPage } from './types';

// ── Response types ──────────────────────────

export interface HeadlineSuggestion {
  text: string;
  style: 'direct' | 'question' | 'statistic' | 'emotional' | 'social_proof';
  estimated_impact: string;
  reasoning: string;
}

export interface FABBlockSuggestion {
  order: number;
  feature: string;
  advantage: string;
  benefit: string;
  section_type: string;
  impact_score: number;
}

export interface FABOrganization {
  blocks: FABBlockSuggestion[];
  strategy_notes: string;
}

export interface CTASuggestion {
  headline: string;
  button_text: string;
  subtext: string;
  urgency_element: string;
  placement: 'hero' | 'mid_page' | 'footer' | 'sticky';
  estimated_ctr: string;
}

export interface LayoutSection {
  order: number;
  section_type: string;
  title: string;
  reasoning: string;
  conversion_role: string;
}

export interface LayoutSuggestion {
  sections: LayoutSection[];
  layout_strategy: string;
  expected_improvement: string;
}

// ── Context types ───────────────────────────

export interface ConversionDesignerContext {
  industry?: string;
  modules?: string[];
  audience?: string;
  currentHeadline?: string;
  currentCTA?: string;
  currentContent?: unknown;
  features?: unknown[];
  sections?: string[];
  goal?: string;
  /** Optional: override page for analytics */
  page?: LandingPage;
}

// ── Service ─────────────────────────────────

class AIConversionService {

  async suggestHeadlines(ctx: ConversionDesignerContext = {}): Promise<HeadlineSuggestion[]> {
    const enriched = await this.enrichContext(ctx);
    const res = await this.call('suggest_headlines', enriched);
    return res.headlines;
  }

  async organizeFAB(ctx: ConversionDesignerContext = {}): Promise<FABOrganization> {
    const enriched = await this.enrichContext(ctx);
    return this.call('organize_fab', enriched);
  }

  async optimizeCTA(ctx: ConversionDesignerContext = {}): Promise<CTASuggestion[]> {
    const enriched = await this.enrichContext(ctx);
    const res = await this.call('optimize_cta', enriched);
    return res.ctas;
  }

  async suggestLayout(ctx: ConversionDesignerContext = {}): Promise<LayoutSuggestion> {
    const enriched = await this.enrichContext(ctx);
    return this.call('suggest_layout', enriched);
  }

  // ── Gather AI Inputs ──────────────────────

  private async enrichContext(ctx: ConversionDesignerContext): Promise<Record<string, unknown>> {
    const base: Record<string, unknown> = { ...ctx };

    try {
      // 1. Revenue Intelligence
      const engine = getRevenueIntelligenceEngine();
      const [metrics, upgradeCandidates] = await Promise.all([
        engine.analyzer.getMetrics(),
        engine.upgrade.getCandidates(),
      ]);
      base.revenueIntelligence = {
        mrr: metrics.mrr,
        arr: metrics.arr,
        arpa: metrics.arpa,
        churnRate: metrics.churn_rate_pct,
        ltv: metrics.ltv_estimate,
        payingTenants: metrics.paying_tenants,
        growthRate: metrics.growth_rate_pct,
        upgradeOpportunities: upgradeCandidates.length,
        topUpgradeSignals: upgradeCandidates.slice(0, 3).map(c => c.signals[0] ?? 'usage'),
      };
    } catch {
      // Revenue Intelligence unavailable — continue without it
    }

    try {
      // 2. Referral Conversion Data
      const refSummary = referralTrackingService.getSummary();
      base.referralData = {
        totalReferrals: refSummary.totalReferrals,
        completedConversions: refSummary.completedConversions,
        pendingConversions: refSummary.pendingConversions,
        referralRevenue: refSummary.totalRevenue,
        conversionRate: refSummary.totalReferrals > 0
          ? Math.round((refSummary.completedConversions / refSummary.totalReferrals) * 100)
          : 0,
        topReferrers: refSummary.topReferrals.slice(0, 3).map(r => ({
          code: r.referralCode,
          revenue: r.totalRevenue,
          complete: r.conversionComplete,
        })),
      };
    } catch {
      // Referral data unavailable
    }

    try {
      // 3. FAB Performance
      const pageId = ctx.page?.id ?? 'lp-1';
      const blueprint = fabContentEngine.generateBlueprint(ctx.industry ?? 'default', ctx.modules ?? []);
      const page = ctx.page ?? { id: pageId, blocks: [], name: '', slug: '/', status: 'draft' as const, analytics: { views: 0, uniqueVisitors: 0, conversions: 0, conversionRate: 0, avgTimeOnPage: 0, bounceRate: 0, topSources: [] }, created_at: '', updated_at: '' };
      const score = aiConversionDesigner.scorePage(page, blueprint);
      base.fabPerformance = {
        totalScore: score.total,
        grade: score.grade,
        breakdown: score.breakdown,
        topSuggestions: score.suggestions.slice(0, 3).map(s => ({
          area: s.area,
          priority: s.priority,
          title: s.title,
          impact: s.expectedImpact,
        })),
      };
    } catch {
      // FAB scoring unavailable
    }

    try {
      // 4. Landing Analytics
      const pageId = ctx.page?.id ?? 'lp-1';
      const funnel = conversionTrackingService.getConversionFunnel(pageId);
      const analytics = ctx.page?.analytics;
      base.landingAnalytics = {
        funnel: {
          views: funnel.views,
          signups: funnel.signups,
          trials: funnel.trials,
          tenantsCreated: funnel.tenantsCreated,
          revenue: funnel.totalRevenue,
          overallConversion: funnel.views > 0
            ? Math.round((funnel.revenueEvents / funnel.views) * 10000) / 100
            : 0,
        },
        page: analytics ? {
          bounceRate: analytics.bounceRate,
          avgTimeOnPage: analytics.avgTimeOnPage,
          conversionRate: analytics.conversionRate,
          topSources: analytics.topSources.slice(0, 3),
        } : null,
        biggestDropoff: this.findBiggestDropoff(funnel),
      };
    } catch {
      // Landing analytics unavailable
    }

    return base;
  }

  private findBiggestDropoff(funnel: ReturnType<typeof conversionTrackingService.getConversionFunnel>) {
    const stages = [
      { from: 'views', to: 'signups', a: funnel.views, b: funnel.signups },
      { from: 'signups', to: 'trials', a: funnel.signups, b: funnel.trials },
      { from: 'trials', to: 'tenants', a: funnel.trials, b: funnel.tenantsCreated },
      { from: 'tenants', to: 'revenue', a: funnel.tenantsCreated, b: funnel.revenueEvents },
    ];
    let worst = { stage: '', rate: 0 };
    for (const s of stages) {
      if (s.a > 0) {
        const drop = Math.round((1 - s.b / s.a) * 100);
        if (drop > worst.rate) worst = { stage: `${s.from}→${s.to}`, rate: drop };
      }
    }
    return worst.rate > 0 ? worst : null;
  }

  // ── Internal ──────────────────────────────

  private async call(action: string, context: Record<string, unknown>): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ai-conversion-designer', {
      body: { action, context },
    });

    if (error) {
      console.error('[AIConversionService] Edge function error:', error);
      throw new Error(error.message ?? 'AI Conversion Designer unavailable');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.result;
  }
}

export const aiConversionService = new AIConversionService();
