/**
 * Employee Document Service
 * CRUD for employee_documents satellite table.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeDocument, CreateEmployeeDocumentDTO } from './types';

export const employeeDocumentService = {
  async listByEmployee(employeeId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('document_type');
    if (error) throw error;
    return (data ?? []) as EmployeeDocument[];
  },

  async create(dto: CreateEmployeeDocumentDTO) {
    const { data, error } = await supabase
      .from('employee_documents')
      .insert(dto as any)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeDocument;
  },

  async update(id: string, tenantId: string, dto: Partial<Omit<EmployeeDocument, 'id' | 'tenant_id' | 'employee_id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('employee_documents')
      .update(dto as any)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeDocument;
  },

  async softDelete(id: string, tenantId: string) {
    const { error } = await supabase
      .from('employee_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },
};
