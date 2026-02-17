/**
 * AnnouncementBanner — Persistent banner at the top of the layout.
 * Shows the highest-priority active announcements with dismiss action.
 * Supports subcategory display from TenantCommunicationCenter.
 */

import { useAnnouncements } from '@/hooks/use-announcements';
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  SUBCATEGORY_CONFIG,
  type PlatformAnnouncement,
} from '@/domains/announcements/announcement-hub';
import { Button } from '@/components/ui/button';
import {
  X, Wrench, Sparkles, CreditCard, ShieldAlert, Scale, Megaphone,
  ArrowRight, Settings, FileText, ShieldOff, Lock, Ban, BookOpen,
  Clock, AlertTriangle, RefreshCw, FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  Wrench, Sparkles, CreditCard, ShieldAlert, Scale, Megaphone,
  Settings, FileText, ShieldOff, Lock, Ban, BookOpen,
  Clock, AlertTriangle, RefreshCw, FileCheck,
  // fallback aliases
  CalendarClock: Clock,
  FileClock: Clock,
  FileWarning: AlertTriangle,
};

function BannerItem({
  announcement: a,
  onDismiss,
  onAction,
}: {
  announcement: PlatformAnnouncement;
  onDismiss: (id: string) => void;
  onAction?: (url: string) => void;
}) {
  const cat = CATEGORY_CONFIG[a.category] ?? CATEGORY_CONFIG.general;
  const pri = PRIORITY_CONFIG[a.priority];
  const sub = a.subcategory ? SUBCATEGORY_CONFIG[a.subcategory] : null;
  const Icon = (sub ? ICON_MAP[sub.icon] : null) ?? ICON_MAP[cat.icon] ?? Megaphone;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 border-b text-sm transition-all',
      pri.bannerClass,
    )}>
      <div className={cn('shrink-0 flex items-center gap-2', cat.color)}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-xs uppercase tracking-wider">
          {sub?.label ?? cat.label}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{a.title}</span>
        <span className="text-muted-foreground ml-2">{a.description}</span>
      </div>

      {a.action_url && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 text-xs gap-1 shrink-0', cat.color)}
          onClick={() => onAction?.(a.action_url!)}
        >
          {a.action_label || 'Ver mais'} <ArrowRight className="h-3 w-3" />
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
