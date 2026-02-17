/**
 * useNotifications — React hook for the Tenant Notification Hub.
 * Provides real-time notifications with Supabase Realtime subscription.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  notificationDispatcher,
  type AppNotification,
} from '@/domains/notifications/notification-hub';

export function useNotifications() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
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
      setNotifications(items);
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
        setNotifications(prev => [n, ...prev].slice(0, 30));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, tenantId]);

  const markRead = useCallback(async (id: string) => {
    await notificationDispatcher.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId || !tenantId) return;
    await notificationDispatcher.markAllRead(userId, tenantId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId, tenantId]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
