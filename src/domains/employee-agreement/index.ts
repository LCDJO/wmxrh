/**
 * Employee Agreement Engine — Bounded Context
 *
 * Manages employee terms, policies, and digital signature lifecycle.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │              EmployeeAgreementEngine                │
 * ├─────────────────────────────────────────────────────┤
 * │  AgreementTemplateService     — CRUD + versioning   │
 * │  AgreementAssignmentService   — dispatch + lifecycle│
 * │  DigitalSignatureProviderAdapter — provider facade  │
 * │  DocumentVault                — signed doc storage  │
 * │  AgreementAuditService        — legal audit trail   │
 * └─────────────────────────────────────────────────────┘
 *
 * Integrations:
 *   - HR Core (auto-dispatch on admission via domain events)
 *   - Security Kernel (tenant_id + company scope)
 *   - Government Integration Gateway (eSocial if needed)
 */

// ── Services ──
export { agreementTemplateService } from './agreement-template.service';
export { agreementAssignmentService } from './agreement-assignment.service';
export { digitalSignatureAdapter } from './digital-signature-adapter';
export { documentVault } from './document-vault';
export { agreementAuditService, initAgreementAudit } from './agreement-audit.service';

// ── Types ──
export type {
  AgreementTipo,
  AgreementStatus,
  SignatureProvider,
  AgreementTemplate,
  AgreementTemplateVersion,
  EmployeeAgreement,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  PublishNewVersionDTO,
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
export { clicksignAdapter } from './adapters/clicksign-adapter';
export { autentiqueAdapter } from './adapters/autentique-adapter';
export { zapsignAdapter } from './adapters/zapsign-adapter';
export { documentStorageAdapter } from './adapters/document-storage';
