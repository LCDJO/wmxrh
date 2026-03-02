/**
 * WorkforceOperationsEngine — Documents Domain
 *
 * Manages employee document lifecycle:
 *   - Document upload, validation, and storage
 *   - Expiry tracking and renewal alerts
 *   - Digital signature workflow
 *   - Document vault integration
 */

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

export class DocumentsService {
  async listByEmployee(tenantId: string, employeeId: string): Promise<EmployeeDocument[]> {
    // Delegates to employee-master-record document service
    return [];
  }

  async getMetrics(tenantId: string): Promise<DocumentMetrics> {
    return {
      total_documents: 0,
      pending_validation: 0,
      expiring_soon: 0,
      expired: 0,
      validated: 0,
    };
  }

  async validateDocument(documentId: string, validatedBy: string): Promise<void> {
    // Will integrate with document-validation domain
  }

  async rejectDocument(documentId: string, reason: string, rejectedBy: string): Promise<void> {
    // Will integrate with document-validation domain
  }
}

let _instance: DocumentsService | null = null;
export function getDocumentsService(): DocumentsService {
  if (!_instance) _instance = new DocumentsService();
  return _instance;
}
