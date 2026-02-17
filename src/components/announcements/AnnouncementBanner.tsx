/**
 * AnnouncementBanner — Persistent banner at the top of the layout.
 * Shows announcements with blocking_level 'banner' or 'restricted_access'.
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
  ArrowRight, Settings, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  CreditCard, ShieldAlert, Megaphone, Settings, FileText,
};

function BannerItem({
  announcement: a,
  onDismiss,
  onAction,
}: {
  announcement: TenantAnnouncement;
  onDismiss: (id: string) => void;
  onAction?: (url: string) => void;
}) {
  const type = ALERT_TYPE_CONFIG[a.alert_type];
  const sev = SEVERITY_CONFIG[a.severity];
  const Icon = ICON_MAP[type.icon] ?? Megaphone;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-b text-sm transition-all',
      sev.bannerClass,
    )}>
      <div className={cn('shrink-0 flex items-center gap-2', type.color)}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-xs uppercase tracking-wider">{type.label}</span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{a.title}</span>
        <span className="text-muted-foreground ml-2">{a.message}</span>
      </div>

      {a.action_url && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 text-xs gap-1 shrink-0', type.color)}
          onClick={() => onAction?.(a.action_url!)}
        >
          Ver mais <ArrowRight className="h-3 w-3" />
        </Button>
      )}

      {a.is_dismissible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(a.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function AnnouncementBanner() {
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
    <div className="w-full">
      {bannerAnnouncements.slice(0, 3).map(a => (
        <BannerItem
          key={a.id}
          announcement={a}
          onDismiss={dismiss}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
