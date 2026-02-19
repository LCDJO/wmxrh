/**
 * Developer Portal & API Marketplace — Module Manifest
 *
 * Platform-level SaaS module providing:
 *  - Developer/partner registration
 *  - App registration & OAuth client management
 *  - API subscription & consumption
 *  - Marketplace catalog & app review
 *  - Integration sandbox testing
 *  - Developer analytics
 *
 * Integrates with:
 *  - Platform API Management System (PAMS)
 *  - BillingCore (subscription billing)
 *  - TenantSandboxEngine (sandbox isolation)
 *  - ModuleVersionRegistry (API versioning)
 *  - Security Kernel (OAuth, scopes, audit)
 *  - Unified Graph Engine (access analysis)
 *  - Control Plane (operational metrics)
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const DEVPORTAL_MODULE_ID = 'developer_portal' as const;

export const DEVPORTAL_EVENTS = {
  DEVELOPER_REGISTERED:    `module:${DEVPORTAL_MODULE_ID}:developer_registered`,
  APP_SUBMITTED:           `module:${DEVPORTAL_MODULE_ID}:app_submitted`,
  APP_APPROVED:            `module:${DEVPORTAL_MODULE_ID}:app_approved`,
  APP_REJECTED:            `module:${DEVPORTAL_MODULE_ID}:app_rejected`,
  APP_PUBLISHED:           `module:${DEVPORTAL_MODULE_ID}:app_published`,
  APP_SUSPENDED:           `module:${DEVPORTAL_MODULE_ID}:app_suspended`,
  OAUTH_CLIENT_CREATED:    `module:${DEVPORTAL_MODULE_ID}:oauth_client_created`,
  OAUTH_CLIENT_ROTATED:    `module:${DEVPORTAL_MODULE_ID}:oauth_client_rotated`,
  API_SUBSCRIPTION_CREATED:`module:${DEVPORTAL_MODULE_ID}:api_subscription_created`,
  API_SUBSCRIPTION_CANCELLED:`module:${DEVPORTAL_MODULE_ID}:api_subscription_cancelled`,
  SANDBOX_SESSION_STARTED: `module:${DEVPORTAL_MODULE_ID}:sandbox_session_started`,
  MARKETPLACE_INSTALL:     `module:${DEVPORTAL_MODULE_ID}:marketplace_install`,
  MARKETPLACE_UNINSTALL:   `module:${DEVPORTAL_MODULE_ID}:marketplace_uninstall`,
} as const;

export const DEVPORTAL_CAPABILITIES = [
  'devportal:developer_registry',
  'devportal:app_registration',
  'devportal:oauth_management',
  'devportal:api_subscriptions',
  'devportal:marketplace_catalog',
  'devportal:app_review',
  'devportal:sandbox_testing',
  'devportal:developer_analytics',
] as const;

export const DEVPORTAL_DEPENDENCIES = [
  'ApiManagement',
  'SecurityKernel',
  'BillingCore',
  'PlatformOS',
  'TenantSandboxEngine',
  'ModuleVersionRegistry',
  'UnifiedGraphEngine',
] as const;

export function initDeveloperPortalModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('version', '1.0.0');
  sandbox.emit('initialized', { module: DEVPORTAL_MODULE_ID });
}
