/**
 * Autonomous Marketing Engine — Barrel export.
 *
 * Architecture:
 *  AutonomousMarketingEngine
 *   ├── ABTestingManager           (experiment lifecycle)
 *   ├── VariantAllocator           (deterministic visitor allocation)
 *   ├── ConversionMetricsCollector (event ingestion + aggregation)
 *   ├── ConversionAnalyzer         (statistical significance + funnels)
 *   ├── LandingPerformanceRanker   (composite scoring + ranking)
 *   ├── AIExperimentAdvisor        (AI-driven experiment recommendations)
 *   ├── TrafficRouter              (rule-based + allocation routing)
 *   └── MarketingInsightsService   (executive-level intelligence)
 */

export { abTestingManager, ABTestingManager } from './ab-testing-manager';
export { variantAllocator, VariantAllocator } from './variant-allocator';
export { conversionMetricsCollector, ConversionMetricsCollector } from './conversion-metrics-collector';
export { conversionAnalyzer, ConversionAnalyzer } from './conversion-analyzer';
export { landingPerformanceRanker, LandingPerformanceRanker } from './landing-performance-ranker';
export { aiExperimentAdvisor, AIExperimentAdvisor } from './ai-experiment-advisor';
export { trafficRouter, TrafficRouter } from './traffic-router';
export { marketingInsightsService, MarketingInsightsService } from './marketing-insights-service';

export type * from './types';
