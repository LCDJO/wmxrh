/**
 * EPI Lifecycle & Legal Compliance Engine — Public API
 *
 * Bounded Context: Gestão do Ciclo de Vida de EPIs
 *
 * Manages EPI delivery, replacement, expiration, digital signatures
 * and legal compliance, integrating with Occupational Risk,
 * NR Training, Safety Automation and Workforce Intelligence.
 */

// Types
export type {
  EpiCatalogItem,
  EpiDelivery,
  EpiDeliveryMotivo,
  EpiDeliveryStatus,
  EpiSignature,
  EpiSignatureType,
  EpiRiskMapping,
  EpiAuditEntry,
  EpiAuditAction,
  ExpiredEpiResult,
  EpiDeliveryInput,
  EpiSignatureInput,
  EpiReplacementInput,
} from './types';

// Delivery Service
export {
  createEpiDelivery,
  replaceEpi,
  returnEpi,
  scanExpiredEpis,
  markDeliveryExpired,
  getEmployeeEpiDeliveries,
} from './delivery.service';

// Signature Service (Legal Proof)
export {
  signEpiDelivery,
  invalidateSignature,
  getDeliverySignatures,
  isDeliverySigned,
} from './signature.service';

// Compliance Service (Cross-module integration)
export {
  getRequiredEpisForRisk,
  createRiskMapping,
  checkEmployeeEpiCompliance,
  processExpiredEpis,
} from './compliance.service';
export type { EpiComplianceResult } from './compliance.service';

// Requirement Engine (Auto-generation from Risk Exposures)
export {
  getPendingRequirements,
  getEmployeeRequirements,
  createRequirement,
  dismissRequirement,
  scanAndGenerateRequirements,
} from './requirement.engine';
export type { EpiRequirement, EpiRequirementWithDetails } from './requirement.engine';

// EPI Signature Integration (Agreement Engine + DocumentVault)
export {
  sendEpiDeliveryForSignature,
  processSignedEpiDelivery,
  quickSignEpiDelivery,
  getSignedDocumentUrl,
} from './epi-signature.integration';
export type { SendForSignatureInput } from './epi-signature.integration';
