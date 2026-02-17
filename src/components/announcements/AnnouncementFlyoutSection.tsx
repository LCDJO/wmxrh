/**
 * AnnouncementFlyoutSection — Section within the NotificationFlyout
 * for TenantAnnouncements (institutional alerts).
 */

import { useAnnouncements } from '@/hooks/use-announcements';
import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  type TenantAnnouncement,
} from '@/domains/announcements/announcement-hub';
import { cn } from '@/lib/utils';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function AnnouncementFlyoutItem({
  announcement: a,
  onDismiss,
}: {
  announcement: TenantAnnouncement;
  onDismiss: (id: string) => void;
}) {
  const type = ALERT_TYPE_CONFIG[a.alert_type];
  const sev = SEVERITY_CONFIG[a.severity];

  return (
    <div className={cn(
      'group flex gap-2.5 px-4 py-2.5 transition-colors',
      sev.bannerClass,
    )}>
      <div className={cn('h-7 w-7 rounded-md flex items-center justify-center shrink-0', type.bgColor, type.color)}>
        <Megaphone className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
          <Badge variant="outline" className={cn('text-[8px] shrink-0', sev.color)}>
            {type.label}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{a.message}</p>
      </div>
      {a.is_dismissible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDismiss(a.id); }}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

export function AnnouncementFlyoutSection() {
  const { flyoutAnnouncements, dismiss } = useAnnouncements();

  if (flyoutAnnouncements.length === 0) return null;

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/30">
        <Megaphone className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Avisos da Plataforma
        </span>
        {flyoutAnnouncements.length > 0 && (
          <Badge variant="secondary" className="text-[9px] ml-auto">
            {flyoutAnnouncements.length}
          </Badge>
        )}
      </div>
      {flyoutAnnouncements.slice(0, 3).map(a => (
        <AnnouncementFlyoutItem key={a.id} announcement={a} onDismiss={dismiss} />
      ))}
    </div>
  );
}
