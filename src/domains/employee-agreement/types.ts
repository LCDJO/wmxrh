/**
 * Employee Agreement Engine — Domain Types
 *
 * Bounded Context for managing employee terms, policies,
 * and digital signature lifecycle.
 */

// ── Enums ──

export type AgreementTipo = 'geral' | 'funcao' | 'empresa' | 'risco';

export type AgreementStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'refused'
  | 'expired'
  | 'cancelled';

export type SignatureProvider =
  | 'opensign'
  | 'docusign'
  | 'clicksign'
  | 'manual'
  | 'simulation';

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

export interface EmployeeAgreement {
  id: string;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  employee_id: string;
  template_id: string;
  template_version_id: string;
  status: AgreementStatus;
  signature_provider: SignatureProvider | null;
  external_document_id: string | null;
  external_signing_url: string | null;
  signed_document_url: string | null;
  signed_document_hash: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  refused_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  refusal_reason: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
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
  status: 'signed' | 'refused';
  signed_document_url?: string;
  signed_document_hash?: string;
  ip_address?: string;
  user_agent?: string;
  refusal_reason?: string;
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
