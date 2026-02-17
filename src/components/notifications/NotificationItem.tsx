/**
 * NotificationItem — Compact notification row for flyout and lists.
 * Enterprise UX: type colors, module icons, slide-in animation, critical highlight.
 */

import { cn } from '@/lib/utils';
import { TYPE_CONFIG, timeAgo, type AppNotification } from '@/domains/notifications/notification-hub';
import { Info, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import { getModuleIcon } from './module-icons';

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
  /** Animate entry (new realtime notification) */
  isNew?: boolean;
}

export function NotificationItem({
  notification: n,
  onRead,
  onAction,
  variant = 'compact',
  isNew = false,
}: NotificationItemProps) {
  const cfg = TYPE_CONFIG[n.type];
  const TypeIcon = TYPE_ICON[n.type] || Info;
  const ModuleIcon = getModuleIcon(n.source_module);
  const isCritical = n.type === 'critical' && !n.is_read;

  const handleClick = () => {
    if (!n.is_read && onRead) onRead(n.id);
    if (n.action_url && onAction) onAction(n.action_url);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex gap-3 transition-all duration-200 cursor-pointer',
        variant === 'compact' ? 'px-4 py-3' : 'px-4 py-4',
        !n.is_read
          ? 'bg-accent/30 hover:bg-accent/50'
          : 'hover:bg-muted/50',
        isCritical && 'bg-destructive/5 hover:bg-destructive/10 border-l-2 border-l-destructive',
        isNew && 'animate-notification-in',
      )}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      {/* Type icon */}
      <div
        className={cn(
          'rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-shadow',
          cfg.bgColor,
          cfg.color,
          variant === 'compact' ? 'h-8 w-8' : 'h-9 w-9',
          isCritical && 'animate-critical-pulse',
        )}
      >
        <TypeIcon className={variant === 'compact' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
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
              'h-2 w-2 rounded-full shrink-0 transition-colors',
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
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50 font-mono">
              <ModuleIcon className="h-2.5 w-2.5" />
              {n.source_module}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
