/**
 * NotificationBell — Bell icon with dropdown for the app header.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import { TYPE_CONFIG, timeAgo, type AppNotification } from '@/domains/notifications/notification-hub';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Bell, CheckCheck, ArrowRight, Info, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

const TYPE_ICON: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
  success: CheckCircle,
};

function NotificationItem({
  notification: n,
  onRead,
  onAction,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onAction: (route: string) => void;
}) {
  const cfg = TYPE_CONFIG[n.type];
  const Icon = TYPE_ICON[n.type] || Info;

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 transition-colors cursor-pointer',
        !n.is_read ? 'bg-accent/30 hover:bg-accent/50' : 'hover:bg-muted/50',
      )}
      onClick={() => {
        if (!n.is_read) onRead(n.id);
        if (n.action_url) onAction(n.action_url);
      }}
    >
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bgColor, cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-xs font-semibold truncate', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
            {n.title}
          </p>
          <div className={cn('h-2 w-2 rounded-full shrink-0', !n.is_read ? cfg.dotColor : 'bg-transparent')} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</span>
          {n.source_module && (
            <span className="text-[9px] text-muted-foreground/50 font-mono">{n.source_module}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleAction = (route: string) => { setOpen(false); navigate(route); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[380px] p-0 shadow-lg border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} novas</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" /> Ler todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.slice(0, 10).map(n => (
                <NotificationItem key={n.id} notification={n} onRead={markRead} onAction={handleAction} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2 bg-card">
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs gap-1 text-primary" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
