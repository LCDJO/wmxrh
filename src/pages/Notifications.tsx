/**
 * Notifications — Full page with filters and bulk actions.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import {
  TYPE_CONFIG,
  timeAgo,
  getUnreadByType,
  type AppNotification,
  type NotificationType,
} from '@/domains/notifications/notification-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  CheckCheck, ArrowRight, Filter,
  Info, AlertTriangle, ShieldAlert, CheckCircle,
  Inbox,
} from 'lucide-react';

const TYPE_ICON: Record<string, React.ElementType> = {
  info: Info, warning: AlertTriangle, critical: ShieldAlert, success: CheckCircle,
};

const ALL_TYPES: NotificationType[] = ['critical', 'warning', 'info', 'success'];

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | null>(null);

  const filtered = useMemo(() => {
    let items = notifications;
    if (tab === 'unread') items = items.filter(n => !n.is_read);
    if (typeFilter) items = items.filter(n => n.type === typeFilter);
    return items;
  }, [notifications, tab, typeFilter]);

  const typeStats = useMemo(() => getUnreadByType(notifications), [notifications]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="flex gap-3">
          {typeStats.critical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-destructive" /> {typeStats.critical} crítica(s)
            </div>
          )}
          {typeStats.warning > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-warning" /> {typeStats.warning} alerta(s)
            </div>
          )}
        </div>
      )}

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
          <Badge variant={typeFilter === null ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setTypeFilter(null)}>
            Todas
          </Badge>
          {ALL_TYPES.map(t => {
            const cfg = TYPE_CONFIG[t];
            const count = typeStats[t];
            if (count === 0 && typeFilter !== t) return null;
            return (
              <Badge key={t} variant={typeFilter === t ? 'default' : 'outline'}
                className={cn('cursor-pointer text-[10px]', typeFilter === t && cfg.bgColor)}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
                {cfg.label} {count > 0 && `(${count})`}
              </Badge>
            );
          })}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type];
            const Icon = TYPE_ICON[n.type] || Info;
            return (
              <Card key={n.id} className={cn('group transition-all cursor-pointer border',
                !n.is_read ? 'border-primary/20 bg-accent/20 hover:bg-accent/40' : 'border-border hover:bg-muted/30')}
                onClick={() => { if (!n.is_read) markRead(n.id); if (n.action_url) navigate(n.action_url); }}>
                <CardContent className="p-4 flex gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cfg.bgColor, cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn('text-sm font-semibold', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>{n.title}</p>
                      <Badge variant="outline" className={cn('text-[9px]', cfg.color)}>{cfg.label}</Badge>
                      {n.source_module && <span className="text-[9px] text-muted-foreground/50 font-mono">{n.source_module}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                      {n.action_url && (
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary px-2"
                          onClick={(e) => { e.stopPropagation(); navigate(n.action_url!); }}>
                          Ver <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start shrink-0">
                    {!n.is_read && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }} title="Marcar como lida">
                        <CheckCheck className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
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
          <p className="text-xs text-muted-foreground/60 mt-1">Eventos do sistema aparecerão aqui automaticamente.</p>
        </div>
      )}
    </div>
  );
}
