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
 *   ├── TagManagerIntegration       (GTM bridge)
 *   ├── ConversionTrackingService   (event tracking + funnel)
 *   └── ReferralTrackingService     (referral attribution + ?ref=CODE)
 */

export { growthInsightEngine, GrowthInsightEngine } from './growth-insight-engine';
export type { GrowthInsightResult } from './growth-insight-engine';
export { planOptimizationAdvisor, PlanOptimizationAdvisor } from './plan-optimization-advisor';
export { conversionPredictionService, ConversionPredictionService } from './conversion-prediction-service';
export { landingPageBuilder, LandingPageBuilder, fabContentEngine, FABContentEngine } from './landing-page-builder';
export { tagManagerIntegration, TagManagerIntegration, gtmInjectionService } from './tag-manager-integration';
export type { GTMAutoEvent } from './tag-manager-integration';
export { conversionTrackingService, ConversionTrackingService } from './conversion-tracking-service';
export { referralTrackingService, ReferralTrackingService } from './referral-tracking-service';
export { growthGovernanceAnalyzer, GrowthGovernanceAnalyzer } from './growth-governance-analyzer';
export type { GrowthGovernanceFinding } from './growth-governance-analyzer';
export { emitGrowthEvent, onGrowthEvent, onGrowthEventType, getGrowthEventLog, clearGrowthEventLog } from './growth.events';
export type { GrowthDomainEvent, GrowthEventType, LandingPageCreatedPayload, LandingPagePublishedPayload, FABContentUpdatedPayload, ConversionTrackedPayload, GrowthInsightGeneratedPayload, WebsitePublishedEventPayload, LandingVersionCreatedEventPayload, AIConversionSuggestedEventPayload, FABSectionGeneratedEventPayload, GTMInjectedEventPayload } from './growth.events';

// ── Website Platform Engine (AI Conversion Designer) ──
export { websitePlatformEngine, WebsitePlatformEngine } from './website-platform-engine';
export { siteStructureManager, SiteStructureManager } from './site-structure-manager';
export type { SitePage, SiteStructure, SitePageMeta } from './site-structure-manager';
export { aiConversionDesigner, AIConversionDesigner } from './ai-conversion-designer';
export type { ConversionScore, ConversionSuggestion, ABTestConfig } from './ai-conversion-designer';
export { versioningManager, VersioningManager } from './versioning-manager';
export type { PageVersion, PageSnapshot, VersionDiff } from './versioning-manager';
export { securePublishService, SecurePublishService } from './secure-publish-service';
export type { PublishResult, PublishError } from './secure-publish-service';
export { seoOptimizationService, SEOOptimizationService } from './seo-optimization-service';
export type { SEOReport, SEOIssue, MetaTags } from './seo-optimization-service';

// ── Landing Template Engine ──
export { landingTemplateEngine, LandingTemplateEngine } from './landing-template-engine';
export type { LandingTemplate, TemplateSection, TemplateSectionType } from './landing-template-engine';

// ── PublicAPI Gateway (security boundary) ──
export { publicAPIGateway, PublicAPIGateway, RateLimiter, createPublicToken, isPublicTokenValid } from './public-api-gateway';
export type { PublicEndpoint, PublicToken, PublicAPIRequest, PublicAPIResponse } from './public-api-gateway';

// ── Landing Conversion Orchestrator (Billing + Referral integration) ──
export { landingConversionOrchestrator, LandingConversionOrchestrator } from './landing-conversion-orchestrator';
export type { LandingConversionInput, LandingConversionResult } from './landing-conversion-orchestrator';

export type * from './types';
