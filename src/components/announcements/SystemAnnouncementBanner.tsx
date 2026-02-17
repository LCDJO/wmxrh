/**
 * SystemAnnouncementBanner — Full-width persistent banner for platform-level alerts.
 * Uses semantic design tokens. Renders at the very top of the layout.
 */

import { useAnnouncements } from '@/hooks/use-announcements';
import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  type TenantAnnouncement,
} from '@/domains/announcements/announcement-hub';
import { Button } from '@/components/ui/button';
import {
  X, CreditCard, ShieldAlert, Megaphone,
  ArrowRight, Settings, FileText, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  CreditCard, ShieldAlert, Megaphone, Settings, FileText,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-info/10 border-info/30 text-info',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  critical: 'bg-destructive/10 border-destructive/30 text-destructive',
};

function BannerRow({
  announcement: a,
  onDismiss,
  onAction,
}: {
  announcement: TenantAnnouncement;
  onDismiss: (id: string) => void;
  onAction: (url: string) => void;
}) {
  const type = ALERT_TYPE_CONFIG[a.alert_type];
  const Icon = ICON_MAP[type.icon] ?? Megaphone;
  const sevStyle = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-b text-sm transition-all',
      sevStyle,
    )}>
      {/* Severity + Type icon */}
      <div className="shrink-0 flex items-center gap-2">
        {a.severity === 'critical' && (
          <AlertTriangle className="h-4 w-4 animate-pulse" />
        )}
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-[10px] uppercase tracking-wider opacity-80">
          {type.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-foreground">{a.title}</span>
        <span className="text-muted-foreground ml-2 text-xs">{a.message}</span>
      </div>

      {/* Action */}
      {a.action_url && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0 hover:bg-background/50"
          onClick={() => onAction(a.action_url!)}
        >
          Resolver <ArrowRight className="h-3 w-3" />
        </Button>
      )}

      {/* Dismiss */}
      {a.is_dismissible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0 opacity-60 hover:opacity-100"
          onClick={() => onDismiss(a.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function SystemAnnouncementBanner() {
  const { bannerAnnouncements, dismiss } = useAnnouncements();

  if (bannerAnnouncements.length === 0) return null;

  const handleAction = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  return (
    <div className="w-full border-b border-border" role="alert">
      {bannerAnnouncements.slice(0, 3).map(a => (
        <BannerRow
          key={a.id}
          announcement={a}
          onDismiss={dismiss}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
