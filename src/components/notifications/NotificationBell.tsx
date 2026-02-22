/**
 * NotificationBell — Bell icon trigger + Flyout popover.
 * Enterprise UX: bell-ring animation, context-aware navigation.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationNavigator } from '@/hooks/use-notification-navigator';
import { NotificationFlyout } from './NotificationFlyout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { navigateToNotification } = useNotificationNavigator();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const prevCount = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setRinging(true);
      const t = setTimeout(() => setRinging(false), 900);
      prevCount.current = unreadCount;
      return () => clearTimeout(t);
    }
    prevCount.current = unreadCount;
    return undefined;
  }, [unreadCount]);

  const handleAction = (route: string) => {
    setOpen(false);
    const n = notifications.find(n => n.action_url === route);
    if (n) {
      navigateToNotification(n);
    } else {
      navigate(route);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/notifications');
  };

  const hasCritical = notifications.some(n => n.type === 'critical' && !n.is_read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className={cn(
            'h-5 w-5 text-muted-foreground transition-colors',
            hasCritical && 'text-destructive',
            ringing && 'animate-bell-ring',
          )} />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold',
              hasCritical
                ? 'bg-destructive text-destructive-foreground animate-critical-pulse'
                : 'bg-primary text-primary-foreground',
            )}>
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
