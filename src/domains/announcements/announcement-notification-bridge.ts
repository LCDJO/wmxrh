/**
 * AnnouncementNotificationBridge
 *
 * Generates SystemNotifications from TenantAnnouncements
 * with institutional icon/styling differentiation.
 *
 * Called when new announcements arrive to create per-user notifications.
 */

import { notificationDispatcher, type CreateNotificationDTO } from '@/domains/notifications/notification-hub';
import {
  type TenantAnnouncement,
  type AlertType,
  type Severity,
  ALERT_TYPE_CONFIG,
  severityToNotificationType,
} from './announcement-hub';

// ══════════════════════════════════════════════════════════════
// Source module identifier for institutional notifications
// ══════════════════════════════════════════════════════════════

const SOURCE_MODULE = 'platform_announcement';

// ══════════════════════════════════════════════════════════════
// Bridge API
// ══════════════════════════════════════════════════════════════

/**
 * Create a SystemNotification for a specific user from a TenantAnnouncement.
 * Uses institutional source_module so the UI can style it differently.
 */
export async function emitAnnouncementNotification(
  announcement: TenantAnnouncement,
  userId: string,
  tenantId: string,
): Promise<void> {
  const typeConfig = ALERT_TYPE_CONFIG[announcement.alert_type];
  const notificationType = severityToNotificationType(announcement.severity);

  const dto: CreateNotificationDTO = {
    tenant_id: tenantId,
    user_id: userId,
    title: `[${typeConfig.label}] ${announcement.title}`,
    description: announcement.message,
    type: notificationType,
    source_module: SOURCE_MODULE,
    action_url: announcement.action_url ?? undefined,
  };

  try {
    await notificationDispatcher.create(dto);
  } catch {
    // Silently fail — notification is secondary to the announcement
    console.warn('[AnnouncementNotificationBridge] Failed to emit notification for announcement:', announcement.id);
  }
}

/**
 * Batch emit notifications for multiple users from a single announcement.
 */
export async function emitAnnouncementNotifications(
  announcement: TenantAnnouncement,
  userIds: string[],
  tenantId: string,
): Promise<void> {
  await Promise.allSettled(
    userIds.map(uid => emitAnnouncementNotification(announcement, uid, tenantId)),
  );
}

/**
 * Check if a notification originated from the announcement bridge.
 */
export function isAnnouncementNotification(sourceModule?: string | null): boolean {
  return sourceModule === SOURCE_MODULE;
}

/**
 * Get the source module identifier for filtering.
 */
export function getAnnouncementSourceModule(): string {
  return SOURCE_MODULE;
}
