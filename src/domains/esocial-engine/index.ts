/**
 * eSocial Integration Engine — Bounded Context
 *
 * Government communication module for Brazilian eSocial system.
 * Decoupled from HR Core and LaborCompliance — operates via domain events.
 *
 * Capabilities:
 *   - Automatic eSocial event generation from internal domain events
 *   - Entity → official layout mapping (S-2200, S-2206, S-2220, etc.)
 *   - Transmission lifecycle control (draft → validated → queued → accepted)
 *   - Layout versioning (S-1.0, S-1.1, S-1.2)
 *
 * Architecture:
 *   - Event Bus: receives InboundDomainEvents from other BCs
 *   - Layout Mappers: pure functions mapping internal data → eSocial XML-JSON
 *   - Transmission Controller: state machine for event lifecycle
 *   - Event Generator: routes domain events → correct eSocial event types
 *   - Service Layer: orchestrates persistence and external API calls
 */

// ── Service (main entry point) ──
export { esocialEngineService } from './esocial-engine.service';

// ── Event Bus ──
export { emitToESocial, onESocialEvent, createDomainEvent, resetESocialHandlers } from './events';

// ── Event Generator ──
export { generateFromDomainEvent, generateBatch } from './event-generator';

// ── Transmission Controller (pure logic) ──
export {
  validateEnvelope,
  canTransition,
  transitionEnvelope,
  applyTransmissionResult,
  getTransmittableEnvelopes,
  computeBatchStats,
} from './transmission-controller';

// ── Layout Mappers ──
export { getMapper, getRegisteredEventTypes, hasMapper } from './layout-mappers';

// ── Types ──
export type {
  LayoutVersion,
  TransmissionStatus,
  ESocialCategory,
  ESocialEventType,
  ESocialEnvelope,
  InboundEventName,
  InboundDomainEvent,
  LayoutMapper,
  ValidationResult,
  ValidationError,
  TransmissionResult,
  ESocialDashboardStats,
} from './types';

export { EVENT_TYPE_REGISTRY, CURRENT_LAYOUT_VERSION } from './types';
