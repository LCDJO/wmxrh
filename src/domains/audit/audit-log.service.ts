import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditLog } from '@/domains/shared';

export const auditLogService = {
  async listByTenant(scope: QueryScope, opts?: { limit?: number; entity_type?: string; action?: string }) {
    let q = applyScope(supabase.from('audit_logs').select('*'), scope, { skipSoftDelete: true, skipScopeFilter: true })
      .order('created_at', { ascending: false });

    if (opts?.entity_type) q = q.eq('entity_type', opts.entity_type);
    if (opts?.action) q = q.eq('action', opts.action);
    q = q.limit(opts?.limit ?? 100);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as AuditLog[];
  },

  async listByEntity(entityType: string, entityId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('audit_logs').select('*'), scope, { skipSoftDelete: true, skipScopeFilter: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as AuditLog[];
  },
};
