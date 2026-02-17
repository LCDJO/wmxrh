/**
 * TenantAnnouncementList — Renders a list of SystemAlertCards.
 * Supports filtering by alert_type and empty state.
 * Uses semantic design tokens.
 */

import { useMemo } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { SystemAlertCard } from './SystemAlertCard';
import { Megaphone } from 'lucide-react';
import type { AlertType } from '@/domains/announcements/announcement-hub';

interface TenantAnnouncementListProps {
  /** Filter by alert_type. If not provided, shows all. */
  filterType?: AlertType;
  /** Max items to display */
  limit?: number;
  /** Use compact cards */
  compact?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
}

export function TenantAnnouncementList({
  filterType,
  limit,
  compact = false,
  emptyMessage = 'Nenhum comunicado no momento',
}: TenantAnnouncementListProps) {
  const { announcements, dismiss, loading } = useAnnouncements();

  const filtered = useMemo(() => {
    let items = announcements;
    if (filterType) {
      items = items.filter(a => a.alert_type === filterType);
    }
    if (limit) {
      items = items.slice(0, limit);
    }
    return items;
  }, [announcements, filterType, limit]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Carregando comunicados...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <Megaphone className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map(a => (
        <SystemAlertCard
          key={a.id}
          announcement={a}
          onDismiss={dismiss}
          compact={compact}
        />
      ))}
    </div>
  );
}
