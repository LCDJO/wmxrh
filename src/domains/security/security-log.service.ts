import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';

export interface SecurityLog {
  id: string;
  request_id: string | null;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  resource: string;
  result: 'allowed' | 'blocked';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const securityLogService = {
  async list(scope: QueryScope, opts?: { limit?: number; result?: 'allowed' | 'blocked'; action?: string }) {
    let q = supabase
      .from('security_logs')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .order('created_at', { ascending: false });

    if (opts?.result) q = q.eq('result', opts.result);
    if (opts?.action) q = q.eq('action', opts.action);
    q = q.limit(opts?.limit ?? 100);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SecurityLog[];
  },
};
