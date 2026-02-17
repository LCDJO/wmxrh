/**
 * Notification — CQRS Read Models
 *
 * Projection-only views derived from AppNotification[].
 * These are query-side contracts — no mutations, no side effects.
 *
 * Views:
 * - UserNotificationListView: paginated, filtered list for UI rendering
 * - NotificationSummaryView: aggregated stats per type/module/date
 * - UnreadCountView: lightweight counter with per-type breakdown
 */

import type { AppNotification, NotificationType } from './notification-hub';
import { TYPE_CONFIG, getUnreadByType } from './notification-hub';

// ══════════════════════════════════════════
// 1. UserNotificationListView
//    Flat read model for list/flyout rendering
// ══════════════════════════════════════════

export interface UserNotificationListItem {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  type_label: string;
  source_module: string | null;
  action_url: string | null;
  is_read: boolean;
  is_critical: boolean;
  created_at: string;
  /** Relative time label (e.g. "2h", "3d") */
  time_ago: string;
  /** Date group for sectioned lists */
  date_group: 'today' | 'yesterday' | 'this_week' | 'older';
  /** Scope context carried from the notification */
  scope: {
    tenant_id: string;
    group_id: string | null;
    company_id: string | null;
  };
}

export interface UserNotificationListView {
  items: UserNotificationListItem[];
  total: number;
  unread_total: number;
  has_critical: boolean;
  /** Available modules for filter chips */
  available_modules: string[];
  /** Projected at */
  projected_at: number;
}

// ── Projector ──

function classifyDateGroup(dateStr: string): UserNotificationListItem['date_group'] {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay());

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= startOfWeek) return 'this_week';
  return 'older';
}

function relativeTime(dateStr: string): string {
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

export function toUserNotificationListView(
  notifications: AppNotification[],
): UserNotificationListView {
  const modules = new Set<string>();

  const items: UserNotificationListItem[] = notifications.map(n => {
    if (n.source_module) modules.add(n.source_module);

    return {
      id: n.id,
      title: n.title,
      description: n.description,
      type: n.type,
      type_label: TYPE_CONFIG[n.type].label,
      source_module: n.source_module ?? null,
      action_url: n.action_url ?? null,
      is_read: n.is_read,
      is_critical: n.type === 'critical' && !n.is_read,
      created_at: n.created_at,
      time_ago: relativeTime(n.created_at),
      date_group: classifyDateGroup(n.created_at),
      scope: {
        tenant_id: n.tenant_id,
        group_id: n.group_id ?? null,
        company_id: n.company_id ?? null,
      },
    };
  });

  return {
    items,
    total: notifications.length,
    unread_total: notifications.filter(n => !n.is_read).length,
    has_critical: items.some(i => i.is_critical),
    available_modules: Array.from(modules).sort(),
    projected_at: Date.now(),
  };
}

// ══════════════════════════════════════════
// 2. NotificationSummaryView
//    Aggregated stats for dashboards and reports
// ══════════════════════════════════════════

export interface TypeSummary {
  type: NotificationType;
  label: string;
  total: number;
  unread: number;
  /** Percentage of total */
  pct: number;
}

export interface ModuleSummary {
  module: string;
  total: number;
  unread: number;
  critical: number;
}

export interface NotificationSummaryView {
  total: number;
  unread: number;
  read: number;
  /** Breakdown by notification type */
  by_type: TypeSummary[];
  /** Breakdown by source module */
  by_module: ModuleSummary[];
  /** Critical unread count (highlighted) */
  critical_unread: number;
  /** Average read time in minutes (null if insufficient data) */
  projected_at: number;
}

export function toNotificationSummaryView(
  notifications: AppNotification[],
): NotificationSummaryView {
  const total = notifications.length;
  const unread = notifications.filter(n => !n.is_read).length;

  // By type
  const types: NotificationType[] = ['critical', 'warning', 'info', 'success'];
  const by_type: TypeSummary[] = types.map(t => {
    const ofType = notifications.filter(n => n.type === t);
    return {
      type: t,
      label: TYPE_CONFIG[t].label,
      total: ofType.length,
      unread: ofType.filter(n => !n.is_read).length,
      pct: total > 0 ? Math.round((ofType.length / total) * 100) : 0,
    };
  });

  // By module
  const moduleMap = new Map<string, { total: number; unread: number; critical: number }>();
  for (const n of notifications) {
    const mod = n.source_module ?? '_unknown';
    const entry = moduleMap.get(mod) ?? { total: 0, unread: 0, critical: 0 };
    entry.total++;
    if (!n.is_read) entry.unread++;
    if (n.type === 'critical') entry.critical++;
    moduleMap.set(mod, entry);
  }

  const by_module: ModuleSummary[] = Array.from(moduleMap.entries())
    .map(([module, stats]) => ({ module, ...stats }))
    .sort((a, b) => b.unread - a.unread);

  return {
    total,
    unread,
    read: total - unread,
    by_type,
    by_module,
    critical_unread: notifications.filter(n => n.type === 'critical' && !n.is_read).length,
    projected_at: Date.now(),
  };
}

// ══════════════════════════════════════════
// 3. UnreadCountView
//    Lightweight counter for bell badge / sidebar
// ══════════════════════════════════════════

export interface UnreadCountView {
  total: number;
  critical: number;
  warning: number;
  info: number;
  success: number;
  /** Whether any critical unread exists (for visual urgency) */
  has_critical: boolean;
  /** Display label for the badge */
  badge_label: string;
  projected_at: number;
}

export function toUnreadCountView(
  notifications: AppNotification[],
): UnreadCountView {
  const byType = getUnreadByType(notifications);
  const total = byType.critical + byType.warning + byType.info + byType.success;

  return {
    total,
    critical: byType.critical,
    warning: byType.warning,
    info: byType.info,
    success: byType.success,
    has_critical: byType.critical > 0,
    badge_label: total > 99 ? '99+' : total > 0 ? String(total) : '',
    projected_at: Date.now(),
  };
}
