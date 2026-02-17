/**
 * useNotifications — React hook for the Tenant Notification Hub.
 * Provides real-time notifications with Supabase Realtime subscription.
 * Filters by AccessGraph: tenant_id + allowed_group_ids + allowed_company_ids.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessGraph } from '@/domains/security/kernel/access-graph';
import {
  notificationDispatcher,
  type AppNotification,
} from '@/domains/notifications/notification-hub';

/**
 * Application-layer filter using the in-memory AccessGraph.
 * This is a defense-in-depth layer on top of RLS.
 */
function filterByAccessGraph(items: AppNotification[]): AppNotification[] {
  const graph = getAccessGraph();
  if (!graph) return items;

  // Tenant-wide users see everything (already filtered by tenant in RLS)
  if (graph.hasTenantScope()) return items;

  const allowedGroups = graph.getReachableGroups();
  const allowedCompanies = graph.getReachableCompanies();

  return items.filter(n => {
    // Tenant-wide notification (no group/company) — visible to all tenant members
    if (!n.group_id && !n.company_id) return true;

    // Company-scoped: must be in allowed companies
    if (n.company_id) {
      return allowedCompanies.has(n.company_id);
    }

    // Group-scoped: must be in allowed groups
    if (n.group_id) {
      return allowedGroups.has(n.group_id);
    }

    return true;
  });
}

export function useNotifications() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const refresh = useCallback(async () => {
    if (!userId || !tenantId) return;
    try {
      const [items, count] = await Promise.all([
        notificationDispatcher.list(userId, tenantId, { limit: 30 }),
        notificationDispatcher.unreadCount(userId, tenantId),
      ]);
      setRawNotifications(items);
      setUnreadCount(count);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId || !tenantId) return;
    const channel = supabase
      .channel(`notifications-${tenantId}-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as unknown as AppNotification;
        setRawNotifications(prev => [n, ...prev].slice(0, 30));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, tenantId]);

  // Apply AccessGraph filter (defense-in-depth on top of RLS)
  const notifications = useMemo(
    () => filterByAccessGraph(rawNotifications),
    [rawNotifications],
  );

  const markRead = useCallback(async (id: string) => {
    await notificationDispatcher.markRead(id);
    setRawNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId || !tenantId) return;
    await notificationDispatcher.markAllRead(userId, tenantId);
    setRawNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId, tenantId]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
