/**
 * Developer Portal & API Marketplace — Public module surface.
 */

export { DEVPORTAL_MODULE_ID, DEVPORTAL_EVENTS, DEVPORTAL_CAPABILITIES, DEVPORTAL_DEPENDENCIES, initDeveloperPortalModule } from './manifest';
export { createDeveloperPortalGateway } from './gateway';
export { DeveloperPortalModuleUI } from './ui';
export { registerDeveloperPortalEventHandlers } from './events';

export {
  DeveloperRegistry,
  AppRegistrationService,
  OAuthClientManager,
  ApiSubscriptionManager,
  MarketplaceCatalog,
  AppReviewWorkflow,
  IntegrationSandboxService,
  DeveloperAnalytics,
} from './engine/developer-platform-engine';

export { DevPortalOAuthIntegration } from './engine/devportal-oauth-integration';
export type {
  DevPortalTokenRequest,
  DevPortalTokenResponse,
  DevPortalIntrospectionResult,
  DevPortalUserInfo,
  DevPortalOIDCDiscovery,
  AppAuthorizationParams,
} from './engine/devportal-oauth-integration';

export type {
  DeveloperTier,
  VerificationLevel,
  AppStatus,
  AppType,
  ReviewStage,
  ReviewResult,
  PricingModel,
  SandboxStatus,
  DeveloperRegistrationRequest,
  DeveloperRegistrationResult,
  AppRegistrationRequest,
  AppRegistrationResult,
  OAuthClientCredentials,
  OAuthRotationResult,
  ApiSubscriptionRequest,
  ApiSubscriptionResult,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  MarketplaceAppCard,
  ReviewChecklistItem,
  AppReviewResult,
  SandboxProvisionRequest,
  SandboxProvisionResult,
  DeveloperDashboardMetrics,
} from './engine/developer-platform-engine';
