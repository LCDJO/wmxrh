/**
 * /platform/marketing/analytics — Marketing Analytics Dashboard
 *
 * Widgets:
 *  - LandingConversionLeaderboard (top pages by conversion)
 *  - VariantPerformanceChart (A/B variant comparison)
 *  - RevenuePerLandingWidget (revenue breakdown per page)
 *  - ABTestHeatmap (experiment × metric heat grid)
 */
import { BarChart3, TrendingUp, FlaskConical, Flame } from 'lucide-react';
import LandingConversionLeaderboard from '@/components/platform/marketing/LandingConversionLeaderboard';
import VariantPerformanceChart from '@/components/platform/marketing/VariantPerformanceChart';
import RevenuePerLandingWidget from '@/components/platform/marketing/RevenuePerLandingWidget';
import ABTestHeatmap from '@/components/platform/marketing/ABTestHeatmap';

export default function MarketingAnalytics() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shadow-sm">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight font-[var(--font-display)]">
            Marketing Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance de landing pages, A/B tests e receita em tempo real.
          </p>
        </div>
      </div>

      {/* Row 1: Leaderboard + Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LandingConversionLeaderboard />
        <RevenuePerLandingWidget />
      </div>

      {/* Row 2: Variant Chart + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <VariantPerformanceChart />
        <ABTestHeatmap />
      </div>
    </div>
  );
}
