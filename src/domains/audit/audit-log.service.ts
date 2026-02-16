import { supabase } from '@/integrations/supabase/client';
import type { IAuditLogService } from '@/domains/shared';
import type { AuditLog } from '@/domains/shared';

export const auditLogService: IAuditLogService = {
  async listByTenant(tenantId: string, opts?: { limit?: number; entity_type?: string; action?: string }) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (opts?.entity_type) query = query.eq('entity_type', opts.entity_type);
    if (opts?.action) query = query.eq('action', opts.action);
    if (opts?.limit) query = query.limit(opts.limit);
    else query = query.limit(100);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AuditLog[];
  },

  async listByEntity(entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AuditLog[];
  },
};
