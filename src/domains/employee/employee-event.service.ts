import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeEvent } from '@/domains/shared';

export const employeeEventService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('employee_events').select('*'), scope, { skipSoftDelete: true })
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeEvent[];
  },

  async listByTenant(scope: QueryScope) {
    const q = applyScope(supabase.from('employee_events').select('*'), scope, { skipSoftDelete: true })
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeEvent[];
  },
};
