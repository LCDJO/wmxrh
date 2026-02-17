/**
 * ActionableNotificationCard — Full card with action button and mark-read.
 * Used in the NotificationListPage for richer interactions.
 */

import { cn } from '@/lib/utils';
import { TYPE_CONFIG, timeAgo, type AppNotification } from '@/domains/notifications/notification-hub';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, ShieldAlert, CheckCircle, CheckCheck, ArrowRight } from 'lucide-react';

const TYPE_ICON: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
  success: CheckCircle,
};

export interface ActionableNotificationCardProps {
  notification: AppNotification;
  onRead: (id: string) => void;
  onAction: (route: string) => void;
}

export function ActionableNotificationCard({
  notification: n,
  onRead,
  onAction,
}: ActionableNotificationCardProps) {
  const cfg = TYPE_CONFIG[n.type];
  const Icon = TYPE_ICON[n.type] || Info;

  return (
    <Card
      className={cn(
        'group transition-all cursor-pointer border',
        !n.is_read
          ? 'border-primary/20 bg-accent/20 hover:bg-accent/40'
          : 'border-border hover:bg-muted/30',
      )}
      onClick={() => {
        if (!n.is_read) onRead(n.id);
        if (n.action_url) onAction(n.action_url);
      }}
    >
      <CardContent className="p-4 flex gap-3">
        {/* Type icon */}
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cfg.bgColor, cfg.color)}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={cn('text-sm font-semibold', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
              {n.title}
            </p>
            <Badge variant="outline" className={cn('text-[9px]', cfg.color)}>
              {cfg.label}
            </Badge>
            {n.source_module && (
              <span className="text-[9px] text-muted-foreground/50 font-mono">{n.source_module}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{n.description}</p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
            {n.action_url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-primary px-2"
                onClick={(e) => { e.stopPropagation(); onAction(n.action_url!); }}
              >
                Ver <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Mark read */}
        <div className="flex items-start shrink-0">
          {!n.is_read && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
              title="Marcar como lida"
            >
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
