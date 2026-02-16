/**
 * DocumentVault Service
 *
 * CRUD for the document_vault table — stores metadata about
 * signed employee documents (the files live in Cloud Storage).
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';

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

export const documentVaultService = {
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

  async create(dto: CreateDocumentVaultDTO, qs: QueryScope): Promise<DocumentVaultRecord> {
    const { data, error } = await supabase
      .from('document_vault')
      .insert({ ...dto, tenant_id: qs.tenantId } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as DocumentVaultRecord;
  },

  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('signed-documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) return null;
    return data.signedUrl;
  },
};
