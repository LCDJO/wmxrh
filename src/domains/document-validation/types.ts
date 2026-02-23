/**
 * Document Validation & LGPD Compliance Engine — Types
 */

export type ValidationTokenStatus = 'active' | 'revoked' | 'expired';
export type AccessResult = 'success' | 'invalid_token' | 'expired' | 'revoked' | 'hash_mismatch';

export interface DocumentValidationToken {
  id: string;
  tenant_id: string;
  document_vault_id: string;
  agreement_id: string | null;
  employee_id: string | null;
  company_id: string | null;
  token: string;
  document_hash: string;
  status: ValidationTokenStatus;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DocumentAccessLog {
  id: string;
  token_id: string;
  tenant_id: string;
  accessed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  requester_name: string | null;
  requester_document: string | null;
  requester_purpose: string | null;
  access_result: AccessResult;
  metadata: Record<string, unknown> | null;
}

export interface IssueValidationTokenDTO {
  tenant_id: string;
  document_vault_id: string;
  agreement_id?: string | null;
  employee_id?: string | null;
  company_id?: string | null;
  document_hash: string;
  expires_at?: string | null;
}

export interface PublicValidationResult {
  valid: boolean;
  status: AccessResult;
  document_name?: string;
  signed_at?: string;
  signer_role?: string;
  company_name?: string;
  hash_verified: boolean;
}

export interface PublicValidationRequest {
  token: string;
  requester_name?: string;
  requester_document?: string;
  requester_purpose?: string;
}
