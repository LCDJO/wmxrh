/**
 * Document Validation & LGPD Compliance Engine — Bounded Context
 *
 * Guarantees signed document authenticity via QR Code public validation,
 * LGPD-compliant access logging, and integration with the Agreement Engine.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │        DocumentValidation & LGPD Compliance             │
 * ├─────────────────────────────────────────────────────────┤
 * │  DocumentValidationService  — tokens + QR URLs          │
 * │  validate-document (Edge)   — public verification API   │
 * │  LGPD Access Logs           — requester tracking        │
 * └─────────────────────────────────────────────────────────┘
 */

export { documentValidationService } from './document-validation.service';
export { signedDocumentRegistry } from './signed-document.service';
export { qrPdfService } from './qr-pdf.service';
export { lgpdValidationLogService } from './lgpd-validation-log.service';
export type { LGPDValidationLog } from './lgpd-validation-log.service';
export type { QRPdfGenerationParams, QRPdfGenerationResult } from './qr-pdf.service';

// Future extensions
export {
  signWithICPBrasil,
  isICPBrasilAvailable,
  anchorOnBlockchain,
  isBlockchainAvailable,
  getPublicApiUrl,
  PUBLIC_API_SPEC,
  downloadLGPDLogs,
  exportLGPDLogsCSV,
  exportLGPDLogsJSON,
} from './future-extensions';

export type {
  ICPBrasilSignatureRequest,
  ICPBrasilSignatureResult,
  BlockchainAnchorRequest,
  BlockchainAnchorResult,
} from './future-extensions';

export type {
  DocumentValidationToken,
  DocumentAccessLog,
  IssueValidationTokenDTO,
  PublicValidationResult,
  PublicValidationRequest,
  ValidationTokenStatus,
  AccessResult,
} from './types';

export type {
  SignedDocument,
  CreateSignedDocumentDTO,
} from './signed-document.types';
