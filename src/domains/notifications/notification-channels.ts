/**
 * Notification Delivery Channels — Port interfaces (Hexagonal Architecture).
 *
 * These ports define the contract for future delivery channels.
 * Adapters will be implemented when each channel is activated.
 *
 * Channels:
 *   - EmailChannel: transactional email via edge function
 *   - PushChannel: web push / mobile push via FCM/APNs
 *   - InAppChannel: current real-time in-app (already implemented)
 */

import type { AppNotification, NotificationType } from './notification-hub';

// ══════════════════════════════════════════
// Delivery Channel Port
// ══════════════════════════════════════════

export type DeliveryChannel = 'in_app' | 'email' | 'push';

export interface DeliveryResult {
  channel: DeliveryChannel;
  success: boolean;
  external_id?: string;
  error?: string;
  delivered_at?: string;
}

export interface NotificationDeliveryPort {
  readonly channel: DeliveryChannel;
  /** Check if this channel is enabled for the tenant */
  isEnabled(tenantId: string): Promise<boolean>;
  /** Deliver a notification through this channel */
  deliver(notification: AppNotification, recipientEmail?: string): Promise<DeliveryResult>;
}

// ══════════════════════════════════════════
// User Notification Preferences
// ══════════════════════════════════════════

export interface ChannelPreference {
  channel: DeliveryChannel;
  enabled: boolean;
}

export interface TypePreference {
  type: NotificationType;
  channels: ChannelPreference[];
  /** Mute this type entirely */
  muted: boolean;
}

export interface ModulePreference {
  module: string;
  /** Override channels for this module (null = use type defaults) */
  channels: ChannelPreference[] | null;
  muted: boolean;
}

export interface UserNotificationPreferences {
  user_id: string;
  tenant_id: string;
  /** Global enable/disable for all notifications */
  global_enabled: boolean;
  /** Per-type preferences */
  by_type: TypePreference[];
  /** Per-module overrides */
  by_module: ModulePreference[];
  /** Quiet hours (UTC) */
  quiet_hours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
  };
  /** Email digest instead of individual emails */
  email_digest: {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
  };
  updated_at: string;
}

// ══════════════════════════════════════════
// Default Preferences Factory
// ══════════════════════════════════════════

const ALL_TYPES: NotificationType[] = ['critical', 'warning', 'info', 'success'];

export function createDefaultPreferences(
  userId: string,
  tenantId: string,
): UserNotificationPreferences {
  return {
    user_id: userId,
    tenant_id: tenantId,
    global_enabled: true,
    by_type: ALL_TYPES.map(type => ({
      type,
      channels: [
        { channel: 'in_app', enabled: true },
        { channel: 'email', enabled: type === 'critical' },
        { channel: 'push', enabled: type === 'critical' || type === 'warning' },
      ],
      muted: false,
    })),
    by_module: [],
    quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
    email_digest: { enabled: false, frequency: 'daily' },
    updated_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════
// Preference Resolver
// ══════════════════════════════════════════

/**
 * Resolves which channels should receive a notification
 * based on user preferences.
 */
export function resolveDeliveryChannels(
  prefs: UserNotificationPreferences,
  notification: AppNotification,
): DeliveryChannel[] {
  if (!prefs.global_enabled) return [];

  // Check quiet hours
  if (prefs.quiet_hours.enabled) {
    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const { start, end } = prefs.quiet_hours;
    const inQuiet = start < end
      ? hhmm >= start && hhmm < end
      : hhmm >= start || hhmm < end;
    // During quiet hours, only deliver critical in-app
    if (inQuiet && notification.type !== 'critical') return [];
  }

  // Module override
  const modPref = prefs.by_module.find(m => m.module === notification.source_module);
  if (modPref?.muted) return [];

  // Type preference
  const typePref = prefs.by_type.find(t => t.type === notification.type);
  if (!typePref || typePref.muted) return [];

  // Resolve channels: module override > type default
  const channelPrefs = modPref?.channels ?? typePref.channels;
  return channelPrefs
    .filter(c => c.enabled)
    .map(c => c.channel);
}
