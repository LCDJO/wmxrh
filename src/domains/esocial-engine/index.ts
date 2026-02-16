/**
 * eSocial Integration Engine — Bounded Context
 *
 * Government communication module for Brazilian eSocial system.
 * Decoupled from HR Core and LaborCompliance — operates via domain events.
 *
 * Architecture Components:
 *   1. EventMapper (layout-mappers/) — Entity → official layout mapping
 *   2. XMLGenerator — Envelope → eSocial-compliant XML
 *   3. DigitalSigner — ICP-Brasil A1/A3 certificate signing (Port)
 *   4. TransmissionService — Batch send with retry & rate limiting
 *   5. ReturnProcessor — Government response parsing & classification
 *   6. LayoutVersionManager — Version migration & compatibility
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

// ── XML Generator ──
export { generateEventXML, generateLoteXML, validateXMLStructure, generateXML, generateBatchXML } from './xml-generator';
export type { ESocialEventXML, ESocialLoteXML, XMLValidationResult, XMLGenerationResult } from './xml-generator';

// ── Digital Signer (Port + Simulation Adapter) ──
export { simulationSigner, checkCertificateExpiry, selectBestCertificate } from './digital-signer';
export type { IDigitalSigner, IA1Adapter, IA3Adapter, DigitalCertificate, CertificateStorage, SignatureResult, SignatureValidation, CertificateValidationResult, CertificateType } from './digital-signer';

// ── Transmission Service (Async Queue) ──
export { transmissionService } from './transmission-service';
export type { TransmissionConfig, IGovernmentAPI, TransmissionBatchResult, TransmissionItemResult, TransmissionItemStatus, QueueItem, QueueCallbacks } from './transmission-service';

// ── Return Processor ──
export { processReturn, processBatchReturn, toTransmissionResult, summarizeBatchReturn } from './return-processor';
export type { GovernmentResponse, GovernmentEventResponse, ProcessedReturn } from './return-processor';

// ── Layout Version Manager ──
export { layoutVersionManager } from './layout-version-manager';
export type { LayoutVersionInfo } from './layout-version-manager';

// ── Layout Mappers (EventMapper) ──
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
