/**
 * Employee Agreement Engine — Future-Ready Types
 *
 * Types for planned features that are not yet implemented.
 * Separated from core types for cleaner architecture.
 */

// ── 1. Assinatura Interna Avançada ──

export interface InternalSignatureMetadata {
  method: 'otp_email' | 'otp_sms' | 'biometric' | 'password_confirm';
  device_fingerprint: string | null;
  geolocation: { lat: number; lng: number } | null;
  otp_validated_at: string | null;
  signature_image_url: string | null;
}

// ── 2. Versionamento Jurídico ──

export interface LegalVersionDiff {
  version_from: number;
  version_to: number;
  diff_html: string;
  legal_review_status: 'pending_review' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  legal_notes: string | null;
}

export interface LegalVersionPolicy {
  requires_re_signature: boolean;
  re_signature_grace_days: number;
  old_version_valid_during_grace: boolean;
}

// ── 3. Renovação Automática de Termos ──

export type RenewalFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'biennial';

export interface RenewalPolicy {
  auto_renew: boolean;
  frequency: RenewalFrequency;
  notify_days_before: number;
  auto_send_days_before: number;
  max_renewals: number | null;
  requires_explicit_signature: boolean;
}

export interface RenewalRecord {
  agreement_id: string;
  original_agreement_id: string;
  renewal_number: number;
  renewed_at: string;
  next_renewal_date: string | null;
  renewal_trigger: 'automatic' | 'manual' | 'version_change';
}

// ── 4. Integração LGPD — Consentimento ──

export type ConsentPurpose =
  | 'data_processing'
  | 'image_usage'
  | 'biometric_collection'
  | 'health_data_sharing'
  | 'marketing'
  | 'third_party_sharing'
  | 'analytics';

export type ConsentLegalBasis =
  | 'consent'
  | 'legal_obligation'
  | 'legitimate_interest'
  | 'contract_execution'
  | 'health_protection';

export interface LgpdConsentRecord {
  id: string;
  employee_id: string;
  tenant_id: string;
  purpose: ConsentPurpose;
  legal_basis: ConsentLegalBasis;
  agreement_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  retention_months: number;
  data_expiry_date: string;
  controller_name: string;
  dpo_contact: string | null;
}

export interface LgpdDataSubjectRequest {
  type: 'access' | 'rectification' | 'deletion' | 'portability' | 'revoke_consent';
  employee_id: string;
  tenant_id: string;
  requested_at: string;
  fulfilled_at: string | null;
  status: 'pending' | 'in_progress' | 'fulfilled' | 'denied';
  denial_reason: string | null;
}
