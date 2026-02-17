/**
 * useAnnouncements — React hook for TenantAnnouncements.
 * Fetches active announcements, filters dismissed, provides dismiss action.
 * Subscribes to Realtime for live updates.
 *
 * Access Graph rules:
 *   - TenantAdmin / owner / superadmin → always see critical announcements
 *   - financeiro role                  → see billing + fiscal alerts
 *   - Other roles                      → see only info-severity announcements
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import {
  announcementDispatcher,
  type TenantAnnouncement,
  type AlertType,
} from '@/domains/announcements/announcement-hub';
import { applyRestrictions, clearRestrictions } from '@/domains/announcements/restriction-bridge';
import type { TenantRole } from '@/domains/shared/types';

// ══════════════════════════════════════════════════════════════
// Access Graph — Role-based visibility rules
// ══════════════════════════════════════════════════════════════

const ADMIN_ROLES: ReadonlySet<TenantRole> = new Set([
  'owner', 'admin', 'superadmin', 'tenant_admin',
]);

const FINANCE_ROLES: ReadonlySet<TenantRole> = new Set([
  'financeiro',
]);

const FINANCE_ALERT_TYPES: ReadonlySet<AlertType> = new Set([
  'billing', 'fiscal',
]);

/**
 * Determines whether a given announcement is visible to the user
 * based on their effective roles from the Access Graph.
 */
function isAnnouncementVisibleForRoles(
  announcement: TenantAnnouncement,
  roles: ReadonlyArray<TenantRole>,
): boolean {
  const isAdmin = roles.some(r => ADMIN_ROLES.has(r));
  const isFinance = roles.some(r => FINANCE_ROLES.has(r));

  // Admin roles: see everything (critical, warnings, info — all types)
  if (isAdmin) return true;

  // Finance roles: see billing/fiscal (any severity) + info-only for others
  if (isFinance) {
    if (FINANCE_ALERT_TYPES.has(announcement.alert_type)) return true;
    return announcement.severity === 'info';
  }

  // Other roles: only informational announcements
  return announcement.severity === 'info';
}

// ══════════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════════

export function useAnnouncements() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { activeContext } = useIdentityIntelligence();
  const [announcements, setAnnouncements] = useState<TenantAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const tenantId = currentTenant?.id;
  const effectiveRoles = activeContext?.effective_roles ?? [];

  const refresh = useCallback(async () => {
    if (!userId || !tenantId) return;
    try {
      const [items, dismissed] = await Promise.all([
        announcementDispatcher.listActive(tenantId),
        announcementDispatcher.getDismissedIds(userId),
      ]);
      setAnnouncements(items);
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
      .channel(`tenant-announcements-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tenant_announcements',
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

  // Active = not dismissed + Access Graph role filter
  const activeAnnouncements = useMemo(
    () => announcements
      .filter(a => !dismissedIds.has(a.id))
      .filter(a => isAnnouncementVisibleForRoles(a, effectiveRoles as TenantRole[])),
    [announcements, dismissedIds, effectiveRoles],
  );

  // Apply restriction overrides via FeatureFlagEngine
  useEffect(() => {
    if (activeAnnouncements.length > 0 && tenantId) {
      applyRestrictions(activeAnnouncements, tenantId);
    } else {
      clearRestrictions();
    }
    return () => clearRestrictions();
  }, [activeAnnouncements, tenantId]);

  // Banner announcements = active + blocking_level is 'banner' or 'restricted_access'
  const bannerAnnouncements = useMemo(
    () => activeAnnouncements.filter(a => a.blocking_level !== 'none'),
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
