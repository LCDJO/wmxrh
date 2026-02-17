/**
 * useNotificationNavigator — Navigates to a notification's action_url
 * while first switching the OperationalContext (ScopeContext) to match
 * the notification's group_id / company_id.
 *
 * This ensures the destination page loads with the correct data scope.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScope } from '@/contexts/ScopeContext';
import { supabase } from '@/integrations/supabase/client';
import type { AppNotification } from '@/domains/notifications/notification-hub';

/**
 * Resolves the company name for a given company ID.
 * Falls back to the ID itself if lookup fails.
 */
async function resolveCompanyName(companyId: string): Promise<string> {
  const { data } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single();
  return data?.name ?? companyId;
}

/**
 * Resolves the group name for a given group ID.
 */
async function resolveGroupName(groupId: string): Promise<string> {
  const { data } = await supabase
    .from('company_groups')
    .select('name')
    .eq('id', groupId)
    .single();
  return data?.name ?? groupId;
}

export function useNotificationNavigator() {
  const navigate = useNavigate();
  const { scope, setGroupScope, setCompanyScope, resetToTenant } = useScope();

  /**
   * Navigate to a notification's action_url, respecting its operational context.
   *
   * Priority:
   *   1. If notification has company_id → switch to company scope
   *   2. If notification has group_id → switch to group scope
   *   3. Otherwise → reset to tenant scope (if not already)
   *
   * Then navigate to the action_url.
   */
  const navigateToNotification = useCallback(async (notification: AppNotification) => {
    const { action_url, company_id, group_id } = notification;
    if (!action_url) return;

    // Switch operational context to match the notification's scope
    if (company_id) {
      if (scope.companyId !== company_id) {
        const name = await resolveCompanyName(company_id);
        // If notification also carries a group, set group first
        if (group_id && scope.groupId !== group_id) {
          const gName = await resolveGroupName(group_id);
          setGroupScope(group_id, gName);
        }
        setCompanyScope(company_id, name);
      }
    } else if (group_id) {
      if (scope.groupId !== group_id) {
        const name = await resolveGroupName(group_id);
        setGroupScope(group_id, name);
      }
    }
    // If notification has no scope hints, leave scope unchanged
    // (user may already be in correct context)

    navigate(action_url);
  }, [navigate, scope, setGroupScope, setCompanyScope]);

  /**
   * Simple wrapper for components that just receive a route string.
   * Looks up the notification to get scope hints, or falls back to direct navigation.
   */
  const navigateToAction = useCallback((route: string, notification?: AppNotification) => {
    if (notification) {
      navigateToNotification(notification);
    } else {
      navigate(route);
    }
  }, [navigate, navigateToNotification]);

  return { navigateToNotification, navigateToAction };
}
