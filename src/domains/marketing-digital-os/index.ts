/**
 * Marketing Digital OS (MDOS) — Barrel export.
 *
 * Centralizes all marketing platform capabilities into a single,
 * governable operating system layer.
 *
 * Architecture:
 *  MarketingDigitalOS
 *   ├── MarketingHubController        (central orchestrator + status)
 *   ├── FunnelOrchestrator            (acquisition funnel management)
 *   ├── CampaignLifecycleManager      (campaign states + asset grouping)
 *   ├── GrowthAISupportLayer          (transversal AI intelligence — re-exported)
 *   ├── MarketingComplianceBridge     (unified compliance for all assets)
 *   ├── ConversionPipeline            (end-to-end conversion flow)
 *   └── MarketingAnalyticsAggregator  (unified analytics aggregation)
 *
 * Growth AI is NOT an isolated module — it operates as a transversal
 * intelligence layer within the MDOS, powering suggestions, scoring,
 * and risk analysis across all marketing subsystems.
 */

// ── MarketingHubController ──
export { marketingHubController, MarketingHubController } from './marketing-hub-controller';
export type { MarketingHubStatus, MarketingAssetSummary } from './marketing-hub-controller';

// ── FunnelOrchestrator ──
export { funnelOrchestrator, FunnelOrchestrator } from './funnel-orchestrator';
export type { MarketingFunnel, FunnelStage, FunnelHealth, FunnelEntryPoint } from './funnel-orchestrator';

// ── CampaignLifecycleManager ──
export { campaignLifecycleManager, CampaignLifecycleManager } from './campaign-lifecycle-manager';
export type { Campaign, CampaignStatus, CampaignAssetRef, CampaignTransition } from './campaign-lifecycle-manager';

// ── GrowthAISupportLayer (transversal — re-exported from platform-growth) ──
export { growthAISupportLayer, GrowthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
export type {
  HeadlineSuggestion,
  FABStructureSuggestion,
  LayoutChangeSuggestion,
  ConversionRiskAnalysis,
  RevenueImpactPrediction,
} from '@/domains/platform-growth/growth-ai-support-layer';

// ── MarketingComplianceBridge ──
export { marketingComplianceBridge, MarketingComplianceBridge } from './marketing-compliance-bridge';
export type { MDOSComplianceResult } from './marketing-compliance-bridge';

// ── ConversionPipeline ──
export { conversionPipeline, ConversionPipeline } from './conversion-pipeline';
export type { ConversionPipelineSnapshot, PipelineStageMetrics } from './conversion-pipeline';

// ── MarketingAnalyticsAggregator ──
export { marketingAnalyticsAggregator, MarketingAnalyticsAggregator } from './marketing-analytics-aggregator';
export type { MarketingKPIs, AssetPerformance, SourceAttribution } from './marketing-analytics-aggregator';
