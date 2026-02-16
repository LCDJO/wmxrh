/**
 * Employee Agreement Engine — Domain Types
 *
 * Bounded Context for managing employee terms, policies,
 * and digital signature lifecycle.
 */

// ── Enums ──

export type AgreementTipo = 'geral' | 'funcao' | 'empresa' | 'risco' | 'lgpd';

export type AgreementStatus =
  | 'pending'
  | 'sent'
  | 'signed'
  | 'rejected'
  | 'expired'
  | 'renewed';

export type SignatureProvider =
  | 'clicksign'
  | 'autentique'
  | 'zapsign'
  | 'docusign'
  | 'opensign'
  | 'manual'
  | 'simulation'
  | 'internal_advanced';

// ── Entities ──

/**
 * AgreementTemplate — Modelo de Termo
 *
 * Exemplos:
 * - Termo de Uso de Imagem
 * - Termo de Confidencialidade
 * - Termo de Direção Veicular
 * - Termo de EPI
 * - Termo LGPD
 */
export interface AgreementTemplate {
  id: string;
  tenant_id: string;
  nome_termo: string;
  descricao: string | null;
  tipo: AgreementTipo;
  obrigatorio: boolean;
  cargo_id: string | null;
  versao: number;
  conteudo_html: string;
  ativo: boolean;
}

export interface AgreementTemplateVersion {
  id: string;
  template_id: string;
  tenant_id: string;
  version_number: number;
  title: string;
  content_html: string;
  content_plain: string | null;
  change_summary: string | null;
  published_at: string | null;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
}

/**
 * EmployeeAgreement — Vínculo do Termo ao Colaborador
 *
 * Regras:
 * - Ao contratar funcionário → associar termos obrigatórios automaticamente
 * - Se cargo exigir termo específico (tipo=funcao) → criar vínculo automático
 */
export interface EmployeeAgreement {
  id: string;
  employee_id: string;
  agreement_template_id: string;
  status: AgreementStatus;
  assinatura_provider_id: SignatureProvider | null;
  data_envio: string | null;
  data_assinatura: string | null;
  documento_assinado_url: string | null;
}

// ── DTOs ──

export interface CreateTemplateDTO {
  nome_termo: string;
  descricao?: string;
  tipo: AgreementTipo;
  obrigatorio?: boolean;
  cargo_id?: string | null;
  conteudo_html: string;
}

export interface UpdateTemplateDTO {
  nome_termo?: string;
  descricao?: string;
  tipo?: AgreementTipo;
  obrigatorio?: boolean;
  cargo_id?: string | null;
  conteudo_html?: string;
  ativo?: boolean;
}

export interface PublishNewVersionDTO {
  template_id: string;
  conteudo_html: string;
  descricao_mudanca?: string;
}

export interface SendForSignatureDTO {
  employee_id: string;
  template_id: string;
  provider?: SignatureProvider;
  company_id?: string;
}

export interface SignatureCallbackDTO {
  agreement_id: string;
  external_document_id: string;
  status: 'signed' | 'rejected';
  documento_assinado_url?: string;
  signed_document_hash?: string;
  ip_address?: string;
  user_agent?: string;
  rejection_reason?: string;
}

// ── Dashboard ──

export interface AgreementDashboardStats {
  total_templates: number;
  active_templates: number;
  total_agreements: number;
  by_status: Record<AgreementStatus, number>;
  pending_signatures: number;
  signed_this_month: number;
  compliance_rate: number; // % of mandatory signed
}

// ════════════════════════════════════════════════
// FUTURE-READY TYPES (preparação futura)
// ════════════════════════════════════════════════

// ── 1. Assinatura Interna Avançada ──

/**
 * Prepared for internal advanced signature (without external provider).
 * Uses biometric/OTP + geolocation + device fingerprint.
 */
export interface InternalSignatureMetadata {
  method: 'otp_email' | 'otp_sms' | 'biometric' | 'password_confirm';
  device_fingerprint: string | null;
  geolocation: { lat: number; lng: number } | null;
  otp_validated_at: string | null;
  signature_image_url: string | null;
}

// ── 2. Versionamento Jurídico ──

/**
 * Tracks legal version diffs for compliance auditing.
 * When a template is updated, the diff between versions is stored.
 */
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
  /** If true, employees must re-sign when a new version is published */
  requires_re_signature: boolean;
  /** Grace period in days for re-signature after new version */
  re_signature_grace_days: number;
  /** If true, old version remains valid until grace period expires */
  old_version_valid_during_grace: boolean;
}

// ── 3. Renovação Automática de Termos ──

export type RenewalFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'biennial';

export interface RenewalPolicy {
  /** Enable auto-renewal for this template */
  auto_renew: boolean;
  /** How often the term should be renewed */
  frequency: RenewalFrequency;
  /** Days before expiry to send renewal notification */
  notify_days_before: number;
  /** Days before expiry to auto-send new agreement */
  auto_send_days_before: number;
  /** Maximum number of auto-renewals (null = unlimited) */
  max_renewals: number | null;
  /** If true, requires explicit re-signature (not just tacit renewal) */
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
  | 'consent'           // Art. 7, I — consentimento
  | 'legal_obligation'  // Art. 7, II — obrigação legal
  | 'legitimate_interest' // Art. 7, IX — interesse legítimo
  | 'contract_execution'  // Art. 7, V — execução de contrato
  | 'health_protection';  // Art. 7, VIII — tutela da saúde

export interface LgpdConsentRecord {
  id: string;
  employee_id: string;
  tenant_id: string;
  purpose: ConsentPurpose;
  legal_basis: ConsentLegalBasis;
  /** Link to the agreement that records this consent */
  agreement_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  /** If revoked, the reason */
  revocation_reason: string | null;
  /** Data retention period in months */
  retention_months: number;
  /** ISO date when data must be deleted */
  data_expiry_date: string;
  /** Controller and DPO info */
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
