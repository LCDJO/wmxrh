/**
 * WorkforceOperationsEngine — Documents Domain
 *
 * Manages employee document lifecycle:
 *   - Document upload, validation, and storage
 *   - Expiry tracking and renewal alerts
 *   - Digital signature workflow
 *   - Document vault integration
 */

import { supabase } from '@/integrations/supabase/client';

export type DocumentCategory =
  | 'identity' | 'address' | 'education' | 'certification'
  | 'contract' | 'medical' | 'legal' | 'financial' | 'other';

export type DocumentStatus = 'pending' | 'validated' | 'rejected' | 'expired' | 'archived';

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  category: DocumentCategory;
  name: string;
  file_url: string | null;
  status: DocumentStatus;
  expiry_date: string | null;
  validated_by: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetrics {
  total_documents: number;
  pending_validation: number;
  expiring_soon: number;
  expired: number;
  validated: number;
}

/**
 * Maps DB row from employee_documents to our domain model.
 */
function toEmployeeDocument(row: any): EmployeeDocument {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    employee_id: row.employee_id,
    category: (row.category ?? 'other') as DocumentCategory,
    name: row.document_type ?? row.document_number ?? 'Documento',
    file_url: row.metadata?.file_url ?? null,
    status: mapStatus(row),
    expiry_date: row.expiry_date ?? null,
    validated_by: row.metadata?.validated_by ?? null,
    validated_at: row.metadata?.validated_at ?? null,
    rejection_reason: row.metadata?.rejection_reason ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStatus(row: any): DocumentStatus {
  if (row.deleted_at) return 'archived';
  if (row.expiry_date && new Date(row.expiry_date) < new Date()) return 'expired';
  if (row.metadata?.status) return row.metadata.status as DocumentStatus;
  return 'validated';
}

export class DocumentsService {
  async listByEmployee(tenantId: string, employeeId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DocumentsService] listByEmployee failed:', error.message);
      return [];
    }

    return (data || []).map(toEmployeeDocument);
  }

  async getMetrics(tenantId: string): Promise<DocumentMetrics> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('id, expiry_date, metadata, deleted_at, category')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (error) {
      console.error('[DocumentsService] getMetrics failed:', error.message);
      return {
        total_documents: 0,
        pending_validation: 0,
        expiring_soon: 0,
        expired: 0,
        validated: 0,
      };
    }

    const rows = data || [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let pending = 0;
    let expiringSoon = 0;
    let expired = 0;
    let validated = 0;

    for (const row of rows) {
      const r = row as any;
      const status = mapStatus(r);

      if (status === 'pending') pending++;
      else if (status === 'expired') expired++;
      else if (status === 'validated') validated++;

      if (r.expiry_date) {
        const exp = new Date(r.expiry_date);
        if (exp > now && exp <= thirtyDaysFromNow) expiringSoon++;
      }
    }

    return {
      total_documents: rows.length,
      pending_validation: pending,
      expiring_soon: expiringSoon,
      expired,
      validated,
    };
  }

  async validateDocument(documentId: string, validatedBy: string): Promise<void> {
    const { error } = await supabase
      .from('employee_documents')
      .update({
        metadata: {
          status: 'validated',
          validated_by: validatedBy,
          validated_at: new Date().toISOString(),
        },
      } as any)
      .eq('id', documentId);

    if (error) {
      console.error('[DocumentsService] validateDocument failed:', error.message);
      throw error;
    }
  }

  async rejectDocument(documentId: string, reason: string, rejectedBy: string): Promise<void> {
    const { error } = await supabase
      .from('employee_documents')
      .update({
        metadata: {
          status: 'rejected',
          rejection_reason: reason,
          rejected_by: rejectedBy,
          rejected_at: new Date().toISOString(),
        },
      } as any)
      .eq('id', documentId);

    if (error) {
      console.error('[DocumentsService] rejectDocument failed:', error.message);
      throw error;
    }
  }
}

let _instance: DocumentsService | null = null;
export function getDocumentsService(): DocumentsService {
  if (!_instance) _instance = new DocumentsService();
  return _instance;
}
