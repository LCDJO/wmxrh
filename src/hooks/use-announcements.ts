/**
 * useAnnouncements — React hook for Platform Announcements.
 * Fetches active announcements, filters dismissed, provides dismiss action.
 * Subscribes to Realtime for live updates.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  announcementDispatcher,
  type PlatformAnnouncement,
} from '@/domains/announcements/announcement-hub';

export function useAnnouncements() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const refresh = useCallback(async () => {
    if (!userId || !tenantId) return;
    try {
      const [items, dismissed] = await Promise.all([
        announcementDispatcher.listActive(tenantId),
        announcementDispatcher.getDismissedIds(userId),
      ]);
      // Filter expired client-side as extra safety
      const now = new Date().getTime();
      setAnnouncements(items.filter(a =>
        !a.expires_at || new Date(a.expires_at).getTime() > now
      ));
      setDismissedIds(dismissed);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`announcements-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'platform_announcements',
      }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, refresh]);

  const dismiss = useCallback(async (id: string) => {
    if (!userId) return;
    setDismissedIds(prev => new Set([...prev, id]));
    await announcementDispatcher.dismiss(id, userId);
  }, [userId]);

  // Active = not dismissed and not expired
  const activeAnnouncements = useMemo(
    () => announcements.filter(a => !dismissedIds.has(a.id)),
    [announcements, dismissedIds],
  );

  // Banner announcements = active + show_banner
  const bannerAnnouncements = useMemo(
    () => activeAnnouncements.filter(a => a.show_banner),
    [activeAnnouncements],
  );

  // For the notification flyout
  const flyoutAnnouncements = useMemo(
    () => activeAnnouncements,
    [activeAnnouncements],
  );

  return {
    announcements: activeAnnouncements,
    bannerAnnouncements,
    flyoutAnnouncements,
    loading,
    dismiss,
    refresh,
  };
}
