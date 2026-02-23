/**
 * Employee Agreement Engine — Core Domain Types
 */

// ── Enums ──

export type AgreementCategoria =
  | 'contrato'
  | 'confidencialidade'
  | 'uso_imagem'
  | 'epi'
  | 'veiculo'
  | 'gps'
  | 'disciplinar'
  | 'lgpd'
  | 'outros';

/** @deprecated Use AgreementCategoria instead */
export type AgreementTipo = AgreementCategoria | 'geral' | 'funcao' | 'empresa' | 'risco';

export type AgreementEscopo =
  | 'global'
  | 'cargo'
  | 'risco'
  | 'funcao_especifica';

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

export interface AgreementTemplate {
  id: string;
  tenant_id: string;
  nome_termo: string;
  descricao: string | null;
  categoria: AgreementCategoria;
  escopo: AgreementEscopo;
  /** @deprecated Use categoria instead */
  tipo: AgreementTipo;
  obrigatorio: boolean;
  cargo_id: string | null;
  cbo_codigo: string | null;
  versao: number;
  conteudo_html: string;
  ativo: boolean;
  exige_assinatura: boolean;
  validade_dias: number | null;
  renovacao_obrigatoria: boolean;
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
  categoria: AgreementCategoria;
  escopo?: AgreementEscopo;
  /** @deprecated Use categoria instead */
  tipo?: AgreementTipo;
  obrigatorio?: boolean;
  cargo_id?: string | null;
  cbo_codigo?: string | null;
  conteudo_html: string;
  exige_assinatura?: boolean;
  validade_dias?: number | null;
  renovacao_obrigatoria?: boolean;
}

export interface UpdateTemplateDTO {
  nome_termo?: string;
  descricao?: string;
  categoria?: AgreementCategoria;
  escopo?: AgreementEscopo;
  /** @deprecated Use categoria instead */
  tipo?: AgreementTipo;
  obrigatorio?: boolean;
  cargo_id?: string | null;
  cbo_codigo?: string | null;
  conteudo_html?: string;
  ativo?: boolean;
  exige_assinatura?: boolean;
  validade_dias?: number | null;
  renovacao_obrigatoria?: boolean;
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
  compliance_rate: number;
}

// ── Re-export future types for backward compatibility ──
export type {
  InternalSignatureMetadata,
  LegalVersionDiff,
  LegalVersionPolicy,
  RenewalFrequency,
  RenewalPolicy,
  RenewalRecord,
  ConsentPurpose,
  ConsentLegalBasis,
  LgpdConsentRecord,
  LgpdDataSubjectRequest,
} from './types-future';
