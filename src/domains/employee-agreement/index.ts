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
 * │  AgreementAutomationService   — auto-dispatch       │
 * │  AgreementExpirationService   — auto-expire         │
 * │  DigitalSignatureProviderAdapter — provider facade  │
 * │  DocumentVault                — unified doc storage │
 * │  AgreementAuditService        — legal audit trail   │
 * └─────────────────────────────────────────────────────┘
 */

// ── Services ──
export { agreementTemplateService } from './agreement-template.service';
export { agreementAssignmentService } from './agreement-assignment.service';
export { digitalSignatureAdapter } from './digital-signature-adapter';
export { documentVault, documentVaultService } from './document-vault';
export type { DocumentVaultRecord, CreateDocumentVaultDTO } from './document-vault';
export { agreementAuditService, initAgreementAudit } from './agreement-audit.service';
export { agreementAutomationService } from './agreement-automation.service';
export { agreementExpirationService } from './agreement-expiration.service';
export { internalSignatureService, legalVersionService, renewalEngineService, lgpdConsentService } from './agreement-future.service';
export { generateDocumentHash, verifyDocumentHash } from './document-hash';

// ── Governance Engine ──
export { agreementGovernanceOrchestrator } from './agreement-governance.orchestrator';
export type {
  GovernanceTrigger,
  GovernanceTriggerSource,
  GovernanceDispatchResult,
  ComplianceGateResult,
  HiringWorkflowTrigger,
  CareerEngineTrigger,
  EPILifecycleTrigger,
  FleetComplianceTrigger,
  NRTrainingTrigger,
  EmployeeRecordTrigger,
  TemplateMatchRule,
} from './integration-contracts';
export { TRIGGER_MATCH_RULES } from './integration-contracts';

// ── Types ──
export type {
  AgreementCategoria,
  AgreementEscopo,
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
