/**
 * LandingPerformanceRanker — Ranks landing pages by composite performance score.
 * Integrates conversion, engagement, revenue, and SEO signals.
 */
import type { LandingPerformanceScore } from './types';
import type { LandingPage } from '../types';

class LandingPerformanceRanker {
  /** Score and rank a set of landing pages */
  rank(pages: LandingPage[]): LandingPerformanceScore[] {
    const scores = pages.map(page => this.scorePage(page));
    scores.sort((a, b) => b.overallScore - a.overallScore);
    scores.forEach((s, i) => { s.rank = i + 1; });
    return scores;
  }

  /** Score a single landing page */
  scorePage(page: LandingPage): LandingPerformanceScore {
    const a = page.analytics;

    // Conversion score (0-100): based on conversion rate
    const conversionScore = Math.min(100, Math.round(a.conversionRate * 10));

    // Engagement score (0-100): inverse of bounce rate + time on page
    const bounceComponent = Math.max(0, 100 - a.bounceRate);
    const timeComponent = Math.min(50, Math.round(a.avgTimeOnPage / 6)); // 5min = 50 points
    const engagementScore = Math.round((bounceComponent + timeComponent) / 1.5);

    // Revenue score (0-100): based on conversions × estimated value
    const revenueScore = Math.min(100, Math.round(a.conversions * 2));

    // SEO score (0-100): heuristic based on blocks and slug quality
    const hasHero = page.blocks.some(b => b.type === 'hero');
    const hasFAQ = page.blocks.some(b => b.type === 'faq');
    const slugQuality = page.slug.length > 3 && page.slug.length < 40 ? 30 : 10;
    const seoScore = Math.min(100, (hasHero ? 25 : 0) + (hasFAQ ? 20 : 0) + slugQuality + page.blocks.length * 3);

    // Weighted composite
    const overallScore = Math.round(
      conversionScore * 0.35 +
      engagementScore * 0.25 +
      revenueScore * 0.25 +
      seoScore * 0.15
    );

    // Trend detection (simplified — would use historical data in production)
    const trend: 'improving' | 'stable' | 'declining' =
      a.conversionRate > 5 ? 'improving' :
      a.conversionRate < 1 ? 'declining' : 'stable';

    return {
      landingPageId: page.id,
      pageName: page.name,
      overallScore,
      conversionScore,
      engagementScore,
      revenueScore,
      seoScore,
      trend,
      rank: 0,
      periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

  /** Get top N pages */
  getTopPerformers(pages: LandingPage[], n: number = 5): LandingPerformanceScore[] {
    return this.rank(pages).slice(0, n);
  }

  /** Get pages needing attention (score < threshold) */
  getUnderperformers(pages: LandingPage[], threshold: number = 40): LandingPerformanceScore[] {
    return this.rank(pages).filter(s => s.overallScore < threshold);
  }
}

export const landingPerformanceRanker = new LandingPerformanceRanker();
export { LandingPerformanceRanker };
