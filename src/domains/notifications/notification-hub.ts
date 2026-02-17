/**
 * NotificationHub — Domain service for the Tenant Notification system.
 *
 * Entity: Notification
 *   id, tenant_id, group_id?, company_id?, user_id?,
 *   title, description, type, source_module,
 *   action_url?, action_command?, is_read, created_at
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type NotificationType = 'info' | 'warning' | 'critical' | 'success';

export interface AppNotification {
  id: string;
  tenant_id: string;
  group_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  title: string;
  description: string;
  type: NotificationType;
  source_module?: string | null;
  action_url?: string | null;
  action_command?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CreateNotificationDTO {
  tenant_id: string;
  user_id?: string;
  group_id?: string;
  company_id?: string;
  title: string;
  description: string;
  type?: NotificationType;
  source_module?: string;
  action_url?: string;
  action_command?: string;
}

// ══════════════════════════════════════════════════════════════
// NotificationDispatcher — CRUD operations
// ══════════════════════════════════════════════════════════════

export const notificationDispatcher = {
  async create(dto: CreateNotificationDTO): Promise<AppNotification> {
    const row = {
      tenant_id: dto.tenant_id,
      user_id: dto.user_id ?? null,
      group_id: dto.group_id ?? null,
      company_id: dto.company_id ?? null,
      title: dto.title,
      description: dto.description,
      type: (dto.type ?? 'info') as string,
      source_module: dto.source_module ?? null,
      action_url: dto.action_url ?? null,
      action_command: dto.action_command ?? null,
    };
    const { data, error } = await supabase
      .from('notifications')
      .insert(row as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AppNotification;
  },

  async list(userId: string, tenantId: string, opts?: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
  }): Promise<AppNotification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (opts?.unreadOnly) query = query.eq('is_read', false);
    if (opts?.type) query = query.eq('type', opts.type);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as AppNotification[];
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as any)
      .eq('id', id);
    if (error) throw error;
  },

  async markAllRead(userId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as any)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);
    if (error) throw error;
  },

  async unreadCount(userId: string, tenantId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  },
};

// ══════════════════════════════════════════════════════════════
// UI Helpers
// ══════════════════════════════════════════════════════════════

export const TYPE_CONFIG: Record<NotificationType, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  info: { label: 'Informação', color: 'text-primary', bgColor: 'bg-primary/10', dotColor: 'bg-primary' },
  success: { label: 'Sucesso', color: 'text-green-600', bgColor: 'bg-green-500/10', dotColor: 'bg-green-500' },
  warning: { label: 'Alerta', color: 'text-warning', bgColor: 'bg-warning/10', dotColor: 'bg-warning' },
  critical: { label: 'Crítico', color: 'text-destructive', bgColor: 'bg-destructive/10', dotColor: 'bg-destructive' },
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function getUnreadByType(notifications: AppNotification[]): Record<NotificationType, number> {
  const unread = notifications.filter(n => !n.is_read);
  return {
    critical: unread.filter(n => n.type === 'critical').length,
    warning: unread.filter(n => n.type === 'warning').length,
    info: unread.filter(n => n.type === 'info').length,
    success: unread.filter(n => n.type === 'success').length,
  };
}
