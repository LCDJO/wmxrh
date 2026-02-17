/**
 * NotificationBell — Bell icon trigger + Flyout popover.
 * Composes NotificationFlyout for the header.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationFlyout } from './NotificationFlyout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleAction = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/notifications');
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
        className="p-0 shadow-lg border border-border rounded-xl overflow-hidden w-auto"
      >
        <NotificationFlyout
          notifications={notifications}
          unreadCount={unreadCount}
          onRead={markRead}
          onReadAll={markAllRead}
          onAction={handleAction}
          onViewAll={handleViewAll}
        />
      </PopoverContent>
    </Popover>
  );
}
