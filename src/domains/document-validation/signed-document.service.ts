/**
 * Signed Document Registry Service
 *
 * Immutable registry of signed documents with SHA-256 hash verification.
 * Integrates with DocumentVault and Document Validation Engine.
 *
 * Immutability enforced at DB level:
 *   - UPDATE blocked on hash, url, signature fields (trigger)
 *   - DELETE blocked entirely (trigger)
 *   - Only 'ativo' can be toggled (soft-deactivation)
 */

import { supabase } from '@/integrations/supabase/client';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import type { SignedDocument, CreateSignedDocumentDTO } from './signed-document.types';

export const signedDocumentRegistry = {

  /**
   * Register a signed document. Hash must be pre-computed over final PDF.
   */
  async register(dto: CreateSignedDocumentDTO): Promise<SignedDocument | null> {
    const { data, error } = await supabase
      .from('signed_documents')
      .insert({
        tenant_id: dto.tenant_id,
        employee_id: dto.employee_id,
        agreement_template_id: dto.agreement_template_id ?? null,
        versao: dto.versao ?? 1,
        hash_sha256: dto.hash_sha256,
        documento_url: dto.documento_url,
        data_assinatura: dto.data_assinatura ?? new Date().toISOString(),
        ip_assinatura: dto.ip_assinatura ?? null,
        provider_signature_id: dto.provider_signature_id ?? null,
        company_id: dto.company_id ?? null,
        metadata: dto.metadata ?? null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[SignedDocumentRegistry] register failed:', error.message);
      return null;
    }
    return data as unknown as SignedDocument;
  },

  /**
   * Register from a Blob (computes SHA-256 automatically).
   */
  async registerFromBlob(
    blob: Blob,
    dto: Omit<CreateSignedDocumentDTO, 'hash_sha256'>,
  ): Promise<SignedDocument | null> {
    const text = await blob.text();
    const hash = await generateDocumentHash(text);
    return this.register({ ...dto, hash_sha256: hash });
  },

  /**
   * Verify document integrity by re-hashing stored PDF.
   */
  async verifyIntegrity(documentId: string, tenantId: string): Promise<{
    valid: boolean;
    stored_hash: string;
    computed_hash: string | null;
  }> {
    const { data, error } = await supabase
      .from('signed_documents')
      .select('hash_sha256, documento_url')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return { valid: false, stored_hash: '', computed_hash: null };

    const row = data as any;
    const { data: fileData, error: dlError } = await supabase.storage
      .from('signed-documents')
      .download(row.documento_url);

    if (dlError || !fileData) return { valid: false, stored_hash: row.hash_sha256, computed_hash: null };

    const text = await fileData.text();
    const computedHash = await generateDocumentHash(text);

    return {
      valid: computedHash === row.hash_sha256,
      stored_hash: row.hash_sha256,
      computed_hash: computedHash,
    };
  },

  /**
   * Soft-deactivate a signed document (only allowed mutation).
   */
  async deactivate(documentId: string, tenantId: string): Promise<boolean> {
    const { error } = await supabase
      .from('signed_documents')
      .update({ ativo: false } as any)
      .eq('id', documentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[SignedDocumentRegistry] deactivate failed:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Get by validation token (for QR code lookups).
   */
  async getByToken(validationToken: string): Promise<SignedDocument | null> {
    const { data, error } = await supabase
      .from('signed_documents')
      .select('*')
      .eq('validation_token', validationToken)
      .single();

    if (error) return null;
    return data as unknown as SignedDocument;
  },

  /**
   * List all signed documents for an employee.
   */
  async listByEmployee(employeeId: string, tenantId: string): Promise<SignedDocument[]> {
    const { data, error } = await supabase
      .from('signed_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('data_assinatura', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as SignedDocument[];
  },

  /**
   * List by agreement template.
   */
  async listByTemplate(templateId: string, tenantId: string): Promise<SignedDocument[]> {
    const { data, error } = await supabase
      .from('signed_documents')
      .select('*')
      .eq('agreement_template_id', templateId)
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('data_assinatura', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as SignedDocument[];
  },
};
