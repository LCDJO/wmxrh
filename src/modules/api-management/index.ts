/**
 * PAMS — Platform API Management System
 * Public module surface.
 */

export { PAMS_MODULE_ID, PAMS_EVENTS, PAMS_CAPABILITIES, PAMS_DEPENDENCIES, initApiManagementModule } from './manifest';
export { createApiManagementGateway } from './gateway';
export { ApiManagementModuleUI } from './ui';
export { registerApiManagementEventHandlers } from './events';

export {
  ApiGatewayController,
  ApiClientRegistry,
  ApiKeyManager,
  ApiScopeResolver,
  ApiRateLimiter,
  ApiUsageTracker,
  ApiVersionRouter,
  ApiAnalyticsService,
} from './engine/api-management-engine';

export type {
  ApiGatewayRequest,
  ApiGatewayResponse,
  KeyGenerationResult,
  RateLimitCheck,
  UsageSummary,
} from './engine/api-management-engine';
