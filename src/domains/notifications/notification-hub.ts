/**
 * NotificationHub — Domain service for the Tenant Notification system.
 *
 * Architecture:
 *   NotificationHub
 *    ├── NotificationEventListener   — Maps domain events → notifications
 *    ├── NotificationAggregator      — Groups/dedupes notifications
 *    ├── NotificationDispatcher      — Writes to DB via Supabase
 *    ├── NotificationPolicyResolver  — Checks scope/role visibility
 *    └── NotificationUIAdapter       — Formats for UI consumption
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type NotificationCategory =
  | 'compliance' | 'security' | 'hr' | 'payroll'
  | 'system' | 'onboarding' | 'approval';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AppNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  icon?: string | null;
  action_label?: string | null;
  action_route?: string | null;
  action_metadata?: Record<string, unknown> | null;
  source_module?: string | null;
  source_event?: string | null;
  is_read: boolean;
  read_at?: string | null;
  is_dismissed: boolean;
  dismissed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface CreateNotificationDTO {
  tenant_id: string;
  user_id: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  action_label?: string;
  action_route?: string;
  action_metadata?: Record<string, string | number | boolean | null>;
  source_module?: string;
  source_event?: string;
  expires_at?: string;
}

// ══════════════════════════════════════════════════════════════
// NotificationDispatcher — CRUD operations
// ══════════════════════════════════════════════════════════════

export const notificationDispatcher = {
  async create(dto: CreateNotificationDTO): Promise<AppNotification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AppNotification;
  },

  async list(userId: string, tenantId: string, opts?: {
    unreadOnly?: boolean;
    category?: NotificationCategory;
    limit?: number;
  }): Promise<AppNotification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (opts?.unreadOnly) query = query.eq('is_read', false);
    if (opts?.category) query = query.eq('category', opts.category);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as AppNotification[];
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllRead(userId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);
    if (error) throw error;
  },

  async dismiss(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async unreadCount(userId: string, tenantId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false)
      .eq('is_dismissed', false);
    if (error) throw error;
    return count ?? 0;
  },
};

// ══════════════════════════════════════════════════════════════
// NotificationEventListener — Maps domain events to notifications
// ══════════════════════════════════════════════════════════════

export interface NotificationEventMap {
  event: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string;
  icon: string;
  actionRoute?: string;
  actionLabel?: string;
}

export const NOTIFICATION_EVENT_MAP: NotificationEventMap[] = [
  {
    event: 'employee.created',
    category: 'hr',
    priority: 'medium',
    titleTemplate: 'Novo colaborador cadastrado',
    messageTemplate: '{name} foi adicionado ao sistema.',
    icon: 'UserPlus',
    actionRoute: '/employees/{id}',
    actionLabel: 'Ver perfil',
  },
  {
    event: 'compliance.violation_detected',
    category: 'compliance',
    priority: 'high',
    titleTemplate: 'Violação de compliance detectada',
    messageTemplate: '{description}',
    icon: 'AlertTriangle',
    actionRoute: '/compliance',
    actionLabel: 'Verificar',
  },
  {
    event: 'security.login_suspicious',
    category: 'security',
    priority: 'critical',
    titleTemplate: 'Login suspeito detectado',
    messageTemplate: 'Atividade incomum detectada para o usuário {email}.',
    icon: 'ShieldAlert',
  },
  {
    event: 'payroll.simulation_ready',
    category: 'payroll',
    priority: 'low',
    titleTemplate: 'Simulação de folha concluída',
    messageTemplate: 'A simulação de {month} está pronta para revisão.',
    icon: 'Calculator',
    actionRoute: '/payroll-simulation',
    actionLabel: 'Ver simulação',
  },
  {
    event: 'onboarding.step_pending',
    category: 'onboarding',
    priority: 'medium',
    titleTemplate: 'Etapa de onboarding pendente',
    messageTemplate: 'Complete a etapa "{step}" para continuar a configuração.',
    icon: 'Rocket',
    actionRoute: '/onboarding',
    actionLabel: 'Continuar',
  },
  {
    event: 'approval.pending',
    category: 'approval',
    priority: 'high',
    titleTemplate: 'Aprovação pendente',
    messageTemplate: '{description} aguarda sua aprovação.',
    icon: 'ClipboardCheck',
  },
];

// ══════════════════════════════════════════════════════════════
// NotificationAggregator — Helpers for grouping
// ══════════════════════════════════════════════════════════════

export function groupByCategory(notifications: AppNotification[]): Record<NotificationCategory, AppNotification[]> {
  const groups = {} as Record<NotificationCategory, AppNotification[]>;
  for (const n of notifications) {
    if (!groups[n.category]) groups[n.category] = [];
    groups[n.category].push(n);
  }
  return groups;
}

export function getUnreadByPriority(notifications: AppNotification[]): {
  critical: number; high: number; medium: number; low: number;
} {
  const unread = notifications.filter(n => !n.is_read);
  return {
    critical: unread.filter(n => n.priority === 'critical').length,
    high: unread.filter(n => n.priority === 'high').length,
    medium: unread.filter(n => n.priority === 'medium').length,
    low: unread.filter(n => n.priority === 'low').length,
  };
}

// ══════════════════════════════════════════════════════════════
// NotificationUIAdapter — Format for display
// ══════════════════════════════════════════════════════════════

export const CATEGORY_CONFIG: Record<NotificationCategory, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  compliance: { label: 'Compliance', color: 'text-warning', bgColor: 'bg-warning/10' },
  security: { label: 'Segurança', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  hr: { label: 'RH', color: 'text-primary', bgColor: 'bg-primary/10' },
  payroll: { label: 'Folha', color: 'text-info', bgColor: 'bg-info/10' },
  system: { label: 'Sistema', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  onboarding: { label: 'Onboarding', color: 'text-primary', bgColor: 'bg-primary/10' },
  approval: { label: 'Aprovação', color: 'text-warning', bgColor: 'bg-warning/10' },
};

export const PRIORITY_CONFIG: Record<NotificationPriority, {
  label: string;
  dotColor: string;
}> = {
  critical: { label: 'Crítico', dotColor: 'bg-destructive' },
  high: { label: 'Alto', dotColor: 'bg-warning' },
  medium: { label: 'Médio', dotColor: 'bg-primary' },
  low: { label: 'Baixo', dotColor: 'bg-muted-foreground' },
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
