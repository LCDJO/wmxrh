/**
 * Agreement Future-Ready Services
 *
 * Stub implementations for planned features:
 *   1. Internal Advanced Signature
 *   2. Legal Version Diffing
 *   3. Automatic Renewal Engine
 *   4. LGPD Consent Management
 *   5. Blockchain Hash Proof
 *   6. Cartório Digital Integration
 *
 * These services define the public API surface.
 * Implementations are no-ops / stubs that log warnings
 * until the features are fully built out.
 */

import type {
  InternalSignatureMetadata,
  LegalVersionDiff,
  LegalVersionPolicy,
  RenewalPolicy,
  RenewalRecord,
  LgpdConsentRecord,
  LgpdDataSubjectRequest,
  ConsentPurpose,
  ConsentLegalBasis,
  BlockchainNetwork,
  BlockchainProofRecord,
  BlockchainProofRequest,
  BlockchainVerificationResult,
  CartorioProvider,
  CartorioRegistrationRecord,
  CartorioSubmissionRequest,
} from './types-future';

const STUB = (name: string) =>
  console.warn(`[AgreementEngine] ${name} is not yet implemented (future feature).`);

// ════════════════════════════════════════════════
// 1. INTERNAL ADVANCED SIGNATURE
// ════════════════════════════════════════════════

export const internalSignatureService = {
  async initiateSignature(
    _agreementId: string,
    _method: InternalSignatureMetadata['method'],
  ): Promise<{ session_token: string } | null> {
    STUB('internalSignatureService.initiateSignature');
    return null;
  },

  async validateAndSign(
    _sessionToken: string,
    _otpCode: string,
    _metadata: Partial<InternalSignatureMetadata>,
  ): Promise<boolean> {
    STUB('internalSignatureService.validateAndSign');
    return false;
  },
};

// ════════════════════════════════════════════════
// 2. LEGAL VERSION DIFFING
// ════════════════════════════════════════════════

export const legalVersionService = {
  async generateDiff(
    _templateId: string,
    _versionFrom: number,
    _versionTo: number,
  ): Promise<LegalVersionDiff | null> {
    STUB('legalVersionService.generateDiff');
    return null;
  },

  async getPolicy(_templateId: string): Promise<LegalVersionPolicy> {
    STUB('legalVersionService.getPolicy');
    return {
      requires_re_signature: false,
      re_signature_grace_days: 30,
      old_version_valid_during_grace: true,
    };
  },

  async checkReSignatureRequired(
    _templateId: string,
    _newVersion: number,
  ): Promise<{ required: boolean; affected_employees: number }> {
    STUB('legalVersionService.checkReSignatureRequired');
    return { required: false, affected_employees: 0 };
  },
};

// ════════════════════════════════════════════════
// 3. AUTOMATIC RENEWAL ENGINE
// ════════════════════════════════════════════════

export const renewalEngineService = {
  async setPolicy(_templateId: string, _policy: RenewalPolicy): Promise<void> {
    STUB('renewalEngineService.setPolicy');
  },

  async getPolicy(_templateId: string): Promise<RenewalPolicy> {
    STUB('renewalEngineService.getPolicy');
    return {
      auto_renew: false,
      frequency: 'annual',
      notify_days_before: 30,
      auto_send_days_before: 7,
      max_renewals: null,
      requires_explicit_signature: true,
    };
  },

  async processUpcomingRenewals(_tenantId: string): Promise<{
    scanned: number;
    renewed: number;
    notified: number;
  }> {
    STUB('renewalEngineService.processUpcomingRenewals');
    return { scanned: 0, renewed: 0, notified: 0 };
  },

  async getRenewalHistory(_agreementId: string): Promise<RenewalRecord[]> {
    STUB('renewalEngineService.getRenewalHistory');
    return [];
  },
};

// ════════════════════════════════════════════════
// 4. LGPD CONSENT MANAGEMENT (Granular)
// ════════════════════════════════════════════════

export const lgpdConsentService = {
  async grantConsent(
    _employeeId: string,
    _tenantId: string,
    _purpose: ConsentPurpose,
    _legalBasis: ConsentLegalBasis,
    _agreementId?: string,
  ): Promise<LgpdConsentRecord | null> {
    STUB('lgpdConsentService.grantConsent');
    return null;
  },

  async revokeConsent(_consentId: string, _reason: string): Promise<boolean> {
    STUB('lgpdConsentService.revokeConsent');
    return false;
  },

  async listConsents(_employeeId: string, _tenantId: string): Promise<LgpdConsentRecord[]> {
    STUB('lgpdConsentService.listConsents');
    return [];
  },

  async submitDataSubjectRequest(
    _request: Omit<LgpdDataSubjectRequest, 'status' | 'fulfilled_at' | 'denial_reason'>,
  ): Promise<LgpdDataSubjectRequest | null> {
    STUB('lgpdConsentService.submitDataSubjectRequest');
    return null;
  },

  async listDataSubjectRequests(_tenantId: string): Promise<LgpdDataSubjectRequest[]> {
    STUB('lgpdConsentService.listDataSubjectRequests');
    return [];
  },

  async getComplianceStatus(_tenantId: string): Promise<{
    total_consents: number;
    active_consents: number;
    pending_requests: number;
    expired_data_count: number;
  }> {
    STUB('lgpdConsentService.getComplianceStatus');
    return { total_consents: 0, active_consents: 0, pending_requests: 0, expired_data_count: 0 };
  },
};

// ════════════════════════════════════════════════
// 5. BLOCKCHAIN HASH PROOF
// ════════════════════════════════════════════════

export const blockchainProofService = {
  /**
   * Anchor a document hash on-chain.
   * Returns the proof record with transaction details.
   */
  async anchorHash(_request: BlockchainProofRequest): Promise<BlockchainProofRecord | null> {
    STUB('blockchainProofService.anchorHash');
    return null;
  },

  /**
   * Verify that a document hash exists on-chain and matches.
   */
  async verifyProof(
    _agreementId: string,
    _documentHash: string,
  ): Promise<BlockchainVerificationResult> {
    STUB('blockchainProofService.verifyProof');
    return {
      valid: false,
      proof: null,
      verified_at: new Date().toISOString(),
      chain_hash_matches: false,
    };
  },

  /**
   * List all blockchain proofs for an agreement.
   */
  async listProofs(_agreementId: string): Promise<BlockchainProofRecord[]> {
    STUB('blockchainProofService.listProofs');
    return [];
  },

  /**
   * Get supported blockchain networks.
   */
  getSupportedNetworks(): BlockchainNetwork[] {
    return ['ethereum', 'polygon', 'bnb_chain', 'hyperledger'];
  },
};

// ════════════════════════════════════════════════
// 6. CARTÓRIO DIGITAL INTEGRATION
// ════════════════════════════════════════════════

export const cartorioDigitalService = {
  /**
   * Submit a signed document for digital notarization.
   */
  async submitForRegistration(
    _request: CartorioSubmissionRequest,
  ): Promise<CartorioRegistrationRecord | null> {
    STUB('cartorioDigitalService.submitForRegistration');
    return null;
  },

  /**
   * Check the registration status at the cartório.
   */
  async checkStatus(_registrationId: string): Promise<CartorioRegistrationRecord | null> {
    STUB('cartorioDigitalService.checkStatus');
    return null;
  },

  /**
   * List all cartório registrations for an agreement.
   */
  async listRegistrations(_agreementId: string): Promise<CartorioRegistrationRecord[]> {
    STUB('cartorioDigitalService.listRegistrations');
    return [];
  },

  /**
   * Cancel a pending cartório registration.
   */
  async cancelRegistration(_registrationId: string): Promise<boolean> {
    STUB('cartorioDigitalService.cancelRegistration');
    return false;
  },

  /**
   * Get supported cartório providers.
   */
  getSupportedProviders(): CartorioProvider[] {
    return ['e-notariado', 'notarchain', 'cerc', 'custom'];
  },
};
