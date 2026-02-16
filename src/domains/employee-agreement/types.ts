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
  | 'signed'
  | 'rejected'
  | 'expired';

export type SignatureProvider =
  | 'clicksign'
  | 'autentique'
  | 'zapsign'
  | 'docusign'
  | 'opensign'
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
