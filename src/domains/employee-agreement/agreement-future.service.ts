/**
 * Agreement Future-Ready Services
 *
 * Stub implementations for planned features:
 *   1. Internal Advanced Signature
 *   2. Legal Version Diffing
 *   3. Automatic Renewal Engine
 *   4. LGPD Consent Management
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
  RenewalFrequency,
  LgpdConsentRecord,
  LgpdDataSubjectRequest,
  ConsentPurpose,
  ConsentLegalBasis,
} from './types-future';

const STUB = (name: string) =>
  console.warn(`[AgreementEngine] ${name} is not yet implemented (future feature).`);

// ════════════════════════════════════════════════
// 1. INTERNAL ADVANCED SIGNATURE
// ════════════════════════════════════════════════

export const internalSignatureService = {
  /**
   * Initiate an internal advanced signature flow
   * (OTP email/SMS + device fingerprint + geolocation).
   */
  async initiateSignature(
    _agreementId: string,
    _method: InternalSignatureMetadata['method'],
  ): Promise<{ session_token: string } | null> {
    STUB('internalSignatureService.initiateSignature');
    return null;
  },

  /**
   * Validate OTP and finalize signature.
   */
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
  /**
   * Generate a diff between two template versions.
   */
  async generateDiff(
    _templateId: string,
    _versionFrom: number,
    _versionTo: number,
  ): Promise<LegalVersionDiff | null> {
    STUB('legalVersionService.generateDiff');
    return null;
  },

  /**
   * Get the legal version policy for a template.
   */
  async getPolicy(_templateId: string): Promise<LegalVersionPolicy> {
    STUB('legalVersionService.getPolicy');
    return {
      requires_re_signature: false,
      re_signature_grace_days: 30,
      old_version_valid_during_grace: true,
    };
  },

  /**
   * Check if employees need to re-sign after version update.
   */
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
  /**
   * Set the renewal policy for a template.
   */
  async setPolicy(
    _templateId: string,
    _policy: RenewalPolicy,
  ): Promise<void> {
    STUB('renewalEngineService.setPolicy');
  },

  /**
   * Get the renewal policy for a template.
   */
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

  /**
   * Scan for agreements expiring soon and trigger renewals.
   * Intended to be called by a cron job / scheduled function.
   */
  async processUpcomingRenewals(_tenantId: string): Promise<{
    scanned: number;
    renewed: number;
    notified: number;
  }> {
    STUB('renewalEngineService.processUpcomingRenewals');
    return { scanned: 0, renewed: 0, notified: 0 };
  },

  /**
   * Get renewal history for an agreement.
   */
  async getRenewalHistory(_agreementId: string): Promise<RenewalRecord[]> {
    STUB('renewalEngineService.getRenewalHistory');
    return [];
  },
};

// ════════════════════════════════════════════════
// 4. LGPD CONSENT MANAGEMENT
// ════════════════════════════════════════════════

export const lgpdConsentService = {
  /**
   * Record a new consent grant linked to an agreement.
   */
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

  /**
   * Revoke a previously granted consent.
   */
  async revokeConsent(
    _consentId: string,
    _reason: string,
  ): Promise<boolean> {
    STUB('lgpdConsentService.revokeConsent');
    return false;
  },

  /**
   * List all active consents for an employee.
   */
  async listConsents(
    _employeeId: string,
    _tenantId: string,
  ): Promise<LgpdConsentRecord[]> {
    STUB('lgpdConsentService.listConsents');
    return [];
  },

  /**
   * Submit a data subject request (access, deletion, portability, etc.).
   */
  async submitDataSubjectRequest(
    _request: Omit<LgpdDataSubjectRequest, 'status' | 'fulfilled_at' | 'denial_reason'>,
  ): Promise<LgpdDataSubjectRequest | null> {
    STUB('lgpdConsentService.submitDataSubjectRequest');
    return null;
  },

  /**
   * Get all data subject requests for a tenant.
   */
  async listDataSubjectRequests(
    _tenantId: string,
  ): Promise<LgpdDataSubjectRequest[]> {
    STUB('lgpdConsentService.listDataSubjectRequests');
    return [];
  },

  /**
   * Check LGPD compliance status for a tenant.
   */
  async getComplianceStatus(_tenantId: string): Promise<{
    total_consents: number;
    active_consents: number;
    pending_requests: number;
    expired_data_count: number;
  }> {
    STUB('lgpdConsentService.getComplianceStatus');
    return {
      total_consents: 0,
      active_consents: 0,
      pending_requests: 0,
      expired_data_count: 0,
    };
  },
};
