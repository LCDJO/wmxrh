/**
 * SystemAlertCard — Standalone card for a single announcement.
 * Reusable in dashboards, detail pages, or modals.
 * Uses semantic design tokens throughout.
 */

import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  BLOCKING_LEVEL_CONFIG,
  type TenantAnnouncement,
} from '@/domains/announcements/announcement-hub';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Megaphone, CreditCard, ShieldAlert, Settings, FileText,
  ExternalLink, Clock, X, AlertTriangle, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ICON_MAP: Record<string, React.ElementType> = {
  CreditCard, FileText, Settings, ShieldAlert,
};

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-info',
  warning: 'border-l-warning',
  critical: 'border-l-destructive',
};

interface SystemAlertCardProps {
  announcement: TenantAnnouncement;
  onDismiss?: (id: string) => void;
  onAction?: (url: string) => void;
  compact?: boolean;
}

export function SystemAlertCard({
  announcement: a,
  onDismiss,
  onAction,
  compact = false,
}: SystemAlertCardProps) {
  const type = ALERT_TYPE_CONFIG[a.alert_type];
  const sev = SEVERITY_CONFIG[a.severity];
  const block = BLOCKING_LEVEL_CONFIG[a.blocking_level];
  const Icon = ICON_MAP[type.icon] ?? Megaphone;

  const handleActionClick = () => {
    if (!a.action_url) return;
    onAction
      ? onAction(a.action_url)
      : a.action_url.startsWith('http')
        ? window.open(a.action_url, '_blank')
        : (window.location.href = a.action_url);
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all border-l-4 hover:shadow-md',
      SEVERITY_BORDER[a.severity] ?? 'border-l-primary',
      a.severity === 'critical' && 'ring-1 ring-destructive/20',
    )}>
      <CardContent className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'rounded-lg flex items-center justify-center shrink-0',
            compact ? 'h-8 w-8' : 'h-10 w-10',
            type.bgColor, type.color,
          )}>
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn(
                'font-semibold text-foreground',
                compact ? 'text-xs' : 'text-sm',
              )}>
                {a.severity === 'critical' && (
                  <AlertTriangle className="inline h-3.5 w-3.5 text-destructive mr-1 animate-pulse" />
                )}
                {a.title}
              </h3>
              <Badge variant="outline" className={cn('text-[10px]', type.color)}>
                {type.label}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', sev.color)}>
                {sev.label}
              </Badge>
              {a.blocking_level === 'restricted_access' && (
                <Badge variant="destructive" className="text-[10px] gap-0.5">
                  <Lock className="h-2.5 w-2.5" />
                  {block.label}
                </Badge>
              )}
            </div>

            {!compact && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {a.message}
              </p>
            )}

            <div className={cn('flex items-center gap-4', compact ? 'mt-1.5' : 'mt-3')}>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(a.start_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </span>

              {a.action_url && (
                <Button
                  variant="link"
                  size="sm"
                  className={cn('h-auto p-0 text-xs gap-1', type.color)}
                  onClick={handleActionClick}
                >
                  Ver mais <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Dismiss */}
          {a.is_dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onDismiss(a.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
