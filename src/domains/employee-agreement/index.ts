/**
 * Employee Agreement Engine — Bounded Context
 *
 * Manages employee terms, policies, and digital signature lifecycle.
 * Integrates with HR Core, Security Kernel, and external signature providers.
 *
 * Architecture (Hexagonal):
 *   1. Ports (ISignatureProvider, IDocumentStorage) — contracts
 *   2. Adapters (OpenSign, Simulation, Cloud Storage) — implementations
 *   3. Service (agreementEngineService) — orchestration
 *   4. Events — domain event bus for integration
 */

// ── Service ──
export { agreementEngineService, setDocumentStorage } from './agreement-engine.service';

// ── Types ──
export type {
  AgreementCategory,
  AgreementStatus,
  SignatureProvider,
  AgreementTemplate,
  AgreementTemplateVersion,
  EmployeeAgreement,
  CreateTemplateDTO,
  CreateVersionDTO,
  SendForSignatureDTO,
  SignatureCallbackDTO,
  AgreementDashboardStats,
} from './types';

// ── Ports ──
export {
  registerSignatureProvider,
  getSignatureProvider,
  listRegisteredProviders,
} from './ports';
export type {
  ISignatureProvider,
  IDocumentStorage,
  SignatureRequest,
  SignatureResponse,
  SignatureStatusResponse,
} from './ports';

// ── Events ──
export {
  emitAgreementEvent,
  onAgreementEvent,
  resetAgreementHandlers,
} from './events';
export type { AgreementEventType, AgreementDomainEvent } from './events';

// ── Adapters ──
export { simulationSignerAdapter } from './adapters/simulation-signer';
export { openSignAdapter } from './adapters/opensign-adapter';
export { documentStorageAdapter } from './adapters/document-storage';
