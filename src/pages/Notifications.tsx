/**
 * Notifications — Full page with filters, categories, and bulk actions.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  timeAgo,
  groupByCategory,
  getUnreadByPriority,
  type AppNotification,
  type NotificationCategory,
} from '@/domains/notifications/notification-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Bell, CheckCheck, X, ArrowRight, Filter,
  UserPlus, AlertTriangle, ShieldAlert, Calculator,
  Rocket, ClipboardCheck, Settings, Info,
  Inbox,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  UserPlus, AlertTriangle, ShieldAlert, Calculator,
  Rocket, ClipboardCheck, Settings, Info,
};

function NotifIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICON_MAP[name]) || Info;
  return <Icon className={className ?? 'h-4 w-4'} />;
}

const ALL_CATEGORIES: NotificationCategory[] = [
  'compliance', 'security', 'hr', 'payroll', 'system', 'onboarding', 'approval',
];

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | null>(null);

  const filtered = useMemo(() => {
    let items = notifications;
    if (tab === 'unread') items = items.filter(n => !n.is_read);
    if (categoryFilter) items = items.filter(n => n.category === categoryFilter);
    return items;
  }, [notifications, tab, categoryFilter]);

  const priorityStats = useMemo(() => getUnreadByPriority(notifications), [notifications]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Priority summary */}
      {unreadCount > 0 && (
        <div className="flex gap-3">
          {priorityStats.critical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              {priorityStats.critical} crítica(s)
            </div>
          )}
          {priorityStats.high > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-warning" />
              {priorityStats.high} alta(s)
            </div>
          )}
          {priorityStats.medium > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-primary" />
              {priorityStats.medium} média(s)
            </div>
          )}
        </div>
      )}

      {/* Tabs + category filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={tab} onValueChange={v => setTab(v as 'all' | 'unread')}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread" className="gap-1">
              Não lidas
              {unreadCount > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={categoryFilter === null ? 'default' : 'outline'}
            className="cursor-pointer text-[10px]"
            onClick={() => setCategoryFilter(null)}
          >
            Todas
          </Badge>
          {ALL_CATEGORIES.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const count = notifications.filter(n => n.category === cat && !n.is_read).length;
            if (count === 0 && categoryFilter !== cat) return null;
            return (
              <Badge
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                className={cn('cursor-pointer text-[10px]', categoryFilter === cat && cfg.bgColor)}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                {cfg.label} {count > 0 && `(${count})`}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Notification list */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(n => {
            const cat = CATEGORY_CONFIG[n.category];
            const pri = PRIORITY_CONFIG[n.priority];

            return (
              <Card
                key={n.id}
                className={cn(
                  'group transition-all cursor-pointer border',
                  !n.is_read
                    ? 'border-primary/20 bg-accent/20 hover:bg-accent/40'
                    : 'border-border hover:bg-muted/30',
                )}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  if (n.action_route) navigate(n.action_route);
                }}
              >
                <CardContent className="p-4 flex gap-3">
                  {/* Icon */}
                  <div className="flex flex-col items-center gap-1.5 pt-0.5">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', pri.dotColor)} />
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cat.bgColor, cat.color)}>
                      <NotifIcon name={n.icon} className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn('text-sm font-semibold', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                        {n.title}
                      </p>
                      <Badge variant="outline" className={cn('text-[9px]', cat.color)}>{cat.label}</Badge>
                      {n.source_module && (
                        <span className="text-[9px] text-muted-foreground/50 font-mono">{n.source_module}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                      {n.action_label && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] gap-1 text-primary px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (n.action_route) navigate(n.action_route);
                          }}
                        >
                          {n.action_label}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-start gap-1 shrink-0">
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        title="Marcar como lida"
                      >
                        <CheckCheck className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      title="Dispensar"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            {tab === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Eventos do sistema aparecerão aqui automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
