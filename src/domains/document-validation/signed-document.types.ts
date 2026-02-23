/**
 * Signed Document Registry — Types
 */

export interface SignedDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  agreement_template_id: string | null;
  versao: number;
  hash_sha256: string;
  validation_token: string;
  documento_url: string;
  data_assinatura: string;
  ip_assinatura: string | null;
  provider_signature_id: string | null;
  ativo: boolean;
  company_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateSignedDocumentDTO {
  tenant_id: string;
  employee_id: string;
  agreement_template_id?: string | null;
  versao?: number;
  hash_sha256: string;
  documento_url: string;
  data_assinatura?: string;
  ip_assinatura?: string | null;
  provider_signature_id?: string | null;
  company_id?: string | null;
  metadata?: Record<string, unknown> | null;
}
