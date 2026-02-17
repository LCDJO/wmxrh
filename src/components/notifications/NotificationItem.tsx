/**
 * NotificationItem — Compact notification row for flyout and lists.
 * Uses design system tokens exclusively.
 */

import { cn } from '@/lib/utils';
import { TYPE_CONFIG, timeAgo, type AppNotification } from '@/domains/notifications/notification-hub';
import { Info, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

const TYPE_ICON: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
  success: CheckCircle,
};

export interface NotificationItemProps {
  notification: AppNotification;
  onRead?: (id: string) => void;
  onAction?: (route: string) => void;
  /** Compact = flyout style, default = page card style */
  variant?: 'compact' | 'default';
}

export function NotificationItem({
  notification: n,
  onRead,
  onAction,
  variant = 'compact',
}: NotificationItemProps) {
  const cfg = TYPE_CONFIG[n.type];
  const Icon = TYPE_ICON[n.type] || Info;

  const handleClick = () => {
    if (!n.is_read && onRead) onRead(n.id);
    if (n.action_url && onAction) onAction(n.action_url);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex gap-3 transition-colors cursor-pointer',
        variant === 'compact' ? 'px-4 py-3' : 'px-4 py-4',
        !n.is_read
          ? 'bg-accent/30 hover:bg-accent/50'
          : 'hover:bg-muted/50',
      )}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          cfg.bgColor,
          cfg.color,
          variant === 'compact' ? 'h-8 w-8' : 'h-9 w-9',
        )}
      >
        <Icon className={variant === 'compact' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'font-semibold truncate',
              variant === 'compact' ? 'text-xs' : 'text-sm',
              !n.is_read ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {n.title}
          </p>
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              !n.is_read ? cfg.dotColor : 'bg-transparent',
            )}
          />
        </div>

        <p className={cn('text-muted-foreground mt-0.5 line-clamp-2', variant === 'compact' ? 'text-[11px]' : 'text-xs')}>
          {n.description}
        </p>

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
