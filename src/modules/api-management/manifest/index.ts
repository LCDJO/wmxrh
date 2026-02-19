/**
 * PAMS — Platform API Management System
 * Module Manifest
 *
 * Integrates with:
 *  - Platform Operating System (ServiceRegistry)
 *  - Domain Gateway (data access)
 *  - Advanced Versioning Engine
 *  - TenantSandboxEngine
 *  - BillingCore (rate limits per plan)
 *  - Security Kernel (scope resolution, audit)
 *  - Unified Graph Engine (access graph)
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export const PAMS_MODULE_ID = 'api_management' as const;

export const PAMS_EVENTS = {
  CLIENT_CREATED: `module:${PAMS_MODULE_ID}:client_created`,
  CLIENT_SUSPENDED: `module:${PAMS_MODULE_ID}:client_suspended`,
  KEY_GENERATED: `module:${PAMS_MODULE_ID}:key_generated`,
  KEY_REVOKED: `module:${PAMS_MODULE_ID}:key_revoked`,
  KEY_ROTATED: `module:${PAMS_MODULE_ID}:key_rotated`,
  RATE_LIMIT_HIT: `module:${PAMS_MODULE_ID}:rate_limit_hit`,
  USAGE_THRESHOLD: `module:${PAMS_MODULE_ID}:usage_threshold`,
  SCOPE_VIOLATION: `module:${PAMS_MODULE_ID}:scope_violation`,
  VERSION_DEPRECATED: `module:${PAMS_MODULE_ID}:version_deprecated`,
} as const;

export const PAMS_CAPABILITIES = [
  'api:key_management',
  'api:client_registry',
  'api:rate_limiting',
  'api:usage_tracking',
  'api:scope_resolution',
  'api:version_routing',
  'api:analytics',
] as const;

export const PAMS_DEPENDENCIES = [
  'SecurityKernel',
  'BillingCore',
  'PlatformOS',
] as const;

export function initApiManagementModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('version', '1.0.0');
  sandbox.emit('initialized', { module: PAMS_MODULE_ID });
}
