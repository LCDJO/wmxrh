import { supabase } from '@/integrations/supabase/client';
import type { IEmployeeEventService } from '@/domains/shared';
import type { EmployeeEvent } from '@/domains/shared';

export const employeeEventService: IEmployeeEventService = {
  async listByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('employee_events')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as EmployeeEvent[];
  },

  async listByTenant(tenantId: string) {
    const { data, error } = await supabase
      .from('employee_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as EmployeeEvent[];
  },
};
