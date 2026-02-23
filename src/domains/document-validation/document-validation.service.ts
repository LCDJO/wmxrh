/**
 * Document Validation & LGPD Compliance Service
 *
 * Issues validation tokens for signed documents, generates QR Code URLs,
 * and provides audit trail for LGPD compliance.
 *
 * Integrations:
 *   - DocumentVault (hash + storage)
 *   - Employee Agreement Engine (agreement context)
 *   - Security Kernel (audit logs)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  DocumentValidationToken,
  DocumentAccessLog,
  IssueValidationTokenDTO,
} from './types';

const VALIDATION_BASE_PATH = '/validate';

export const documentValidationService = {

  /**
   * Issue a new validation token for a signed document.
   * Generates the unique token server-side via DB default.
   */
  async issueToken(dto: IssueValidationTokenDTO): Promise<DocumentValidationToken | null> {
    const { data, error } = await supabase
      .from('document_validation_tokens')
      .insert({
        tenant_id: dto.tenant_id,
        document_vault_id: dto.document_vault_id,
        agreement_id: dto.agreement_id ?? null,
        employee_id: dto.employee_id ?? null,
        company_id: dto.company_id ?? null,
        document_hash: dto.document_hash,
        expires_at: dto.expires_at ?? null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[DocumentValidation] Failed to issue token:', error.message);
      return null;
    }

    return data as unknown as DocumentValidationToken;
  },

  /**
   * Generate the public validation URL for QR Code embedding.
   */
  getValidationUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}${VALIDATION_BASE_PATH}/${token}`;
  },

  /**
   * Generate the edge function URL for programmatic validation.
   */
  getApiValidationUrl(token: string): string {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/validate-document?token=${token}`;
  },

  /**
   * Revoke a validation token (e.g. document superseded).
   */
  async revokeToken(tokenId: string, revokedBy: string): Promise<boolean> {
    const { error } = await supabase
      .from('document_validation_tokens')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
      } as any)
      .eq('id', tokenId);

    if (error) {
      console.error('[DocumentValidation] Failed to revoke token:', error.message);
      return false;
    }
    return true;
  },

  /**
   * List all validation tokens for a document vault entry.
   */
  async listByDocument(documentVaultId: string, tenantId: string): Promise<DocumentValidationToken[]> {
    const { data, error } = await supabase
      .from('document_validation_tokens')
      .select('*')
      .eq('document_vault_id', documentVaultId)
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as DocumentValidationToken[];
  },

  /**
   * List all validation tokens for a tenant.
   */
  async listByTenant(tenantId: string, limit = 100): Promise<DocumentValidationToken[]> {
    const { data, error } = await supabase
      .from('document_validation_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as DocumentValidationToken[];
  },

  /**
   * Get LGPD access logs for a specific token.
   */
  async getAccessLogs(tokenId: string, tenantId: string): Promise<DocumentAccessLog[]> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('*')
      .eq('token_id', tokenId)
      .eq('tenant_id', tenantId)
      .order('accessed_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as DocumentAccessLog[];
  },

  /**
   * Get all access logs for a tenant (LGPD audit).
   */
  async getAllAccessLogs(tenantId: string, limit = 200): Promise<DocumentAccessLog[]> {
    const { data, error } = await supabase
      .from('document_access_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('accessed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as DocumentAccessLog[];
  },
};
