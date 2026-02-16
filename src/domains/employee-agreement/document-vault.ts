/**
 * DocumentVault
 *
 * Responsible for storing and retrieving signed agreement documents.
 * Uses Lovable Cloud Storage (bucket: signed-documents).
 *
 * Path convention: {tenant_id}/{agreement_id}/{filename}
 *
 * Documents are NEVER stored in the database — only URLs/paths
 * are persisted in employee_agreements.signed_document_url.
 */

import { supabase } from '@/integrations/supabase/client';
import { digitalSignatureAdapter } from './digital-signature-adapter';
import type { SignatureProvider } from './types';

const BUCKET = 'signed-documents';

export const documentVault = {

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
   * Remove a stored document.
   */
  async remove(storagePath: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);
    return !error;
  },
};
