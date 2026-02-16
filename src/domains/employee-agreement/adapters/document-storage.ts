/**
 * Document Storage Adapter — Lovable Cloud Storage
 *
 * Stores signed documents in the 'signed-documents' bucket.
 * Path structure: {tenant_id}/{agreement_id}/{filename}
 */

import { supabase } from '@/integrations/supabase/client';
import type { IDocumentStorage } from '../ports';

const BUCKET = 'signed-documents';

export const documentStorageAdapter: IDocumentStorage = {
  async upload(tenantId: string, agreementId: string, file: Blob, filename: string): Promise<string> {
    const path = `${tenantId}/${agreementId}/${filename}`;
    
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return path;
  },

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
    return data.signedUrl;
  },

  async remove(path: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    return !error;
  },
};
