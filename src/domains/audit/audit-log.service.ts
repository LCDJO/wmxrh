import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditLog } from '@/domains/shared';

export const auditLogService = {
  async listByTenant(scope: QueryScope, opts?: { limit?: number; offset?: number; entity_type?: string; action?: string; search?: string }) {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    let q = applyScope(supabase.from('audit_logs').select('*', { count: 'exact' }), scope, { skipSoftDelete: true, skipScopeFilter: true })
      .order('created_at', { ascending: false });

    if (opts?.entity_type) q = q.eq('entity_type', opts.entity_type);
    if (opts?.action) q = q.eq('action', opts.action);
    if (opts?.search) {
      const s = opts.search;
      q = q.or(`entity_type.ilike.%${s}%,entity_id.ilike.%${s}%,action.ilike.%${s}%`);
    }
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;
    return { data: (data || []) as AuditLog[], total: count ?? 0 };
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
