/**
 * DocumentVault — Unified Service
 *
 * Combines:
 *   1. Signed document storage (Cloud Storage bucket: signed-documents)
 *   2. Document metadata CRUD (document_vault table)
 *
 * Path convention: {tenant_id}/{agreement_id}/{filename}
 */

import { supabase } from '@/integrations/supabase/client';
import { digitalSignatureAdapter } from './digital-signature-adapter';
import type { SignatureProvider } from './types';
import type { QueryScope } from '@/domains/shared/scoped-query';

const BUCKET = 'signed-documents';

// ── Types ──

export interface DocumentVaultRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  agreement_id: string | null;
  company_id: string | null;
  company_group_id: string | null;
  nome_documento: string;
  tipo_documento: string;
  url_arquivo: string;
  assinatura_valida: boolean;
  hash_documento: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentVaultDTO {
  tenant_id: string;
  employee_id: string;
  agreement_id?: string | null;
  company_id?: string | null;
  company_group_id?: string | null;
  nome_documento: string;
  tipo_documento: string;
  url_arquivo: string;
  assinatura_valida?: boolean;
  hash_documento?: string | null;
}

// ── Unified Service ──

export const documentVault = {

  // ════════════════════════════════════════
  // Storage Operations (signed PDFs)
  // ════════════════════════════════════════

  /**
   * Download signed doc from provider and store in Cloud Storage.
   * Returns the storage path (or null if download failed).
   */
  async storeSignedDocument(
    tenantId: string,
    agreementId: string,
    externalDocumentId: string,
    providerName: SignatureProvider,
  ): Promise<string | null> {
    try {
      const blob = await digitalSignatureAdapter.download(providerName, externalDocumentId);
      if (!blob) return null;

      const path = `${tenantId}/${agreementId}/signed_${agreementId}.pdf`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        console.error('[DocumentVault] Upload failed:', error.message);
        return null;
      }

      return path;
    } catch (err) {
      console.error('[DocumentVault] storeSignedDocument error:', err);
      return null;
    }
  },

  /**
   * Generate a temporary signed URL for viewing a stored document.
   */
  async getViewUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.error('[DocumentVault] Failed to create signed URL:', error.message);
      return null;
    }
    return data.signedUrl;
  },

  /**
   * Remove a stored document from Cloud Storage.
   */
  async removeFromStorage(storagePath: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);
    return !error;
  },

  // ════════════════════════════════════════
  // Metadata Operations (document_vault table)
  // ════════════════════════════════════════

  /**
   * List all documents for an employee.
   */
  async listByEmployee(employeeId: string, qs: QueryScope): Promise<DocumentVaultRecord[]> {
    const { data, error } = await supabase
      .from('document_vault')
      .select('*')
      .eq('tenant_id', qs.tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as DocumentVaultRecord[];
  },

  /**
   * Create a document metadata record.
   */
  async create(dto: CreateDocumentVaultDTO, qs: QueryScope): Promise<DocumentVaultRecord> {
    const { data, error } = await supabase
      .from('document_vault')
      .insert({ ...dto, tenant_id: qs.tenantId } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as DocumentVaultRecord;
  },

  /**
   * Get a signed URL (alias for getViewUrl, used by metadata consumers).
   */
  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
    return this.getViewUrl(storagePath, expiresInSeconds);
  },
};

// ── Backward compatibility alias ──
export const documentVaultService = documentVault;
