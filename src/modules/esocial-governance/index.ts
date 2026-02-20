/**
 * eSocial Governance Module — Public API
 *
 * Canonical module structure:
 *  /manifest — ID, constants, initialization
 *  /gateway  — data access via sandbox
 *  /ui       — lazy-loadable components
 *  /events   — cross-module event handlers
 */

export { ESOCIAL_GOV_MODULE_ID, ESOCIAL_GOV_EVENTS, initEsocialGovModule } from './manifest';
export { createEsocialGovGateway } from './gateway';
export { EsocialGovModuleUI } from './ui';
export { registerEsocialGovEventHandlers } from './events';
