/**
 * Traccar Integration Module — Public API
 *
 * Platform (SaaS): global server config, ingest engine
 * Tenant (Client): device mapping, speed policies, compliance
 */
export { TRACCAR_MODULE_ID, TRACCAR_MODULE_LAYERS, TRACCAR_EVENTS, initTraccarModule } from './manifest';
export { createTraccarGateway } from './gateway';
export { TraccarModuleUI } from './ui';
export { registerTraccarEventHandlers } from './events';
