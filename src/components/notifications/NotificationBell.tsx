/**
 * NotificationBell — Bell icon with dropdown for the app header.
 * Shows unread count badge and a floating panel with recent notifications.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  timeAgo,
  type AppNotification,
} from '@/domains/notifications/notification-hub';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Bell, CheckCheck, ArrowRight, X,
  UserPlus, AlertTriangle, ShieldAlert, Calculator,
  Rocket, ClipboardCheck, Settings, Info,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  UserPlus, AlertTriangle, ShieldAlert, Calculator,
  Rocket, ClipboardCheck, Settings, Info,
};

function NotifIcon({ name }: { name?: string | null }) {
  const Icon = (name && ICON_MAP[name]) || Info;
  return <Icon className="h-4 w-4" />;
}

function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onAction,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (route: string) => void;
}) {
  const cat = CATEGORY_CONFIG[notification.category];
  const pri = PRIORITY_CONFIG[notification.priority];

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-3 transition-colors cursor-pointer',
        !notification.is_read
          ? 'bg-accent/30 hover:bg-accent/50'
          : 'hover:bg-muted/50',
      )}
      onClick={() => {
        if (!notification.is_read) onRead(notification.id);
        if (notification.action_route) onAction(notification.action_route);
      }}
    >
      {/* Priority dot */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className={cn('h-2 w-2 rounded-full shrink-0', pri.dotColor)} />
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', cat.bgColor, cat.color)}>
          <NotifIcon name={notification.icon} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-xs font-semibold truncate', !notification.is_read ? 'text-foreground' : 'text-muted-foreground')}>
            {notification.title}
          </p>
          <Badge variant="outline" className={cn('text-[9px] shrink-0', cat.color)}>
            {cat.label}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground/70">{timeAgo(notification.created_at)}</span>
          {notification.action_label && (
            <button
              className="text-[10px] text-primary font-medium hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (notification.action_route) onAction(notification.action_route);
              }}
            >
              {notification.action_label} →
            </button>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 rounded hover:bg-muted transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleAction = (route: string) => {
    setOpen(false);
    navigate(route);
  };

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

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 shadow-lg border border-border rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{unreadCount} novas</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3 w-3" />
                Ler todas
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.slice(0, 10).map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markRead}
                  onDismiss={dismiss}
                  onAction={handleAction}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2 bg-card">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs gap-1 text-primary"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
            >
              Ver todas as notificações
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
