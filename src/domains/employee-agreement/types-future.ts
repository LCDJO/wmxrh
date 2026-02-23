/**
 * Employee Agreement Engine — Future-Ready Types
 *
 * Types for planned features (stubs until fully implemented).
 *
 *   1. Assinatura Interna Avançada
 *   2. Versionamento Jurídico (Diff)
 *   3. Renovação Automática de Termos
 *   4. Integração LGPD — Consentimento Granular
 *   5. Blockchain Hash Proof
 *   6. Integração com Cartório Digital
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

// ── 4. Integração LGPD — Consentimento Granular ──

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

// ── 5. Blockchain Hash Proof ──

export type BlockchainNetwork = 'ethereum' | 'polygon' | 'bnb_chain' | 'hyperledger';

export interface BlockchainProofRecord {
  id: string;
  agreement_id: string;
  tenant_id: string;
  document_hash: string;
  transaction_hash: string;
  block_number: number;
  network: BlockchainNetwork;
  timestamp: string;
  contract_address: string | null;
  verification_url: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BlockchainProofRequest {
  agreement_id: string;
  document_hash: string;
  network: BlockchainNetwork;
  metadata?: Record<string, unknown>;
}

export interface BlockchainVerificationResult {
  valid: boolean;
  proof: BlockchainProofRecord | null;
  verified_at: string;
  chain_hash_matches: boolean;
}

// ── 6. Integração com Cartório Digital ──

export type CartorioProvider = 'e-notariado' | 'notarchain' | 'cerc' | 'custom';
export type CartorioRequestStatus = 'draft' | 'submitted' | 'processing' | 'registered' | 'rejected' | 'cancelled';

export interface CartorioRegistrationRecord {
  id: string;
  agreement_id: string;
  tenant_id: string;
  provider: CartorioProvider;
  external_protocol: string | null;
  status: CartorioRequestStatus;
  submitted_at: string | null;
  registered_at: string | null;
  registration_number: string | null;
  selo_digital: string | null;
  certificate_url: string | null;
  cost_brl: number | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CartorioSubmissionRequest {
  agreement_id: string;
  provider: CartorioProvider;
  document_hash: string;
  signers: CartorioSigner[];
  metadata?: Record<string, unknown>;
}

export interface CartorioSigner {
  name: string;
  cpf: string;
  email: string;
  role: 'signatory' | 'witness' | 'intervening_party';
}
