/**
 * Platform Growth AI + Landing Page Builder — Barrel export.
 *
 * Architecture:
 *  PlatformGrowthAI
 *   ├── GrowthInsightEngine         (AI-powered growth strategies)
 *   ├── PlanOptimizationAdvisor     (plan upgrade recommendations)
 *   ├── ConversionPredictionService (lead scoring)
 *   ├── LandingPageBuilder          (CRUD + page management)
 *   ├── FABContentEngine            (Features-Advantages-Benefits copy)
 *   ├── TagManagerIntegration       (GTM bridge)
 *   └── ConversionTrackingService   (event tracking + funnel)
 */

export { growthInsightEngine, GrowthInsightEngine } from './growth-insight-engine';
export { planOptimizationAdvisor, PlanOptimizationAdvisor } from './plan-optimization-advisor';
export { conversionPredictionService, ConversionPredictionService } from './conversion-prediction-service';
export { landingPageBuilder, LandingPageBuilder, fabContentEngine, FABContentEngine } from './landing-page-builder';
export { tagManagerIntegration, TagManagerIntegration } from './tag-manager-integration';
export { conversionTrackingService, ConversionTrackingService } from './conversion-tracking-service';
export type * from './types';
