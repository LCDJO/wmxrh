/**
 * NotificationFlyout — Floating panel content shown inside a Popover.
 * Renders a scrollable list of NotificationItems with header + footer.
 */

import { type AppNotification } from '@/domains/notifications/notification-hub';
import { NotificationItem } from './NotificationItem';
import { AnnouncementFlyoutSection } from '@/components/announcements/AnnouncementFlyoutSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';

export interface NotificationFlyoutProps {
  notifications: AppNotification[];
  unreadCount: number;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onAction: (route: string) => void;
  onViewAll: () => void;
  /** Max items to show in the flyout */
  maxItems?: number;
}

export function NotificationFlyout({
  notifications,
  unreadCount,
  onRead,
  onReadAll,
  onAction,
  onViewAll,
  maxItems = 10,
}: NotificationFlyoutProps) {
  return (
    <div className="w-[380px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {unreadCount} novas
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={onReadAll}
          >
            <CheckCheck className="h-3 w-3" /> Ler todas
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[400px]">
        {/* Institutional announcements section */}
        <AnnouncementFlyoutSection />

        {notifications.length > 0 ? (
          <div className="divide-y divide-border/50">
            {notifications.slice(0, maxItems).map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={onRead}
                onAction={onAction}
                variant="compact"
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
            onClick={onViewAll}
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
