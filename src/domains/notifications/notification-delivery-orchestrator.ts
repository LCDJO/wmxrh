/**
 * Notification Delivery Orchestrator
 *
 * Routes notifications to the correct delivery channels
 * based on user preferences. Integrates with the Runtime Engine
 * for automation triggers.
 *
 * Current state:
 *   ✅ in_app — fully implemented via notificationDispatcher
 *   🔜 email  — stub, ready for edge function adapter
 *   🔜 push   — stub, ready for FCM/APNs adapter
 *   🔜 automations — stub, ready for Runtime Engine integration
 */

import type { AppNotification } from './notification-hub';
import type {
  DeliveryChannel,
  DeliveryResult,
  NotificationDeliveryPort,
  UserNotificationPreferences,
} from './notification-channels';
import {
  createDefaultPreferences,
  resolveDeliveryChannels,
} from './notification-channels';

// ══════════════════════════════════════════
// Channel Registry
// ══════════════════════════════════════════

const channelAdapters = new Map<DeliveryChannel, NotificationDeliveryPort>();

export function registerDeliveryChannel(adapter: NotificationDeliveryPort): void {
  channelAdapters.set(adapter.channel, adapter);
}

// ══════════════════════════════════════════
// In-App Channel (already active)
// ══════════════════════════════════════════

const inAppChannel: NotificationDeliveryPort = {
  channel: 'in_app',
  async isEnabled() { return true; },
  async deliver(notification) {
    // Already handled by notificationDispatcher.create() upstream
    return {
      channel: 'in_app',
      success: true,
      delivered_at: new Date().toISOString(),
    };
  },
};

channelAdapters.set('in_app', inAppChannel);

// ══════════════════════════════════════════
// Email Channel Stub
// ══════════════════════════════════════════

const emailChannelStub: NotificationDeliveryPort = {
  channel: 'email',
  async isEnabled(_tenantId: string) {
    // TODO: check tenant plan + email config
    return false;
  },
  async deliver(notification, recipientEmail) {
    // TODO: call edge function `send-notification-email`
    console.info('[EmailChannel] stub — would send to', recipientEmail, notification.title);
    return {
      channel: 'email',
      success: false,
      error: 'Email channel not yet implemented',
    };
  },
};

channelAdapters.set('email', emailChannelStub);

// ══════════════════════════════════════════
// Push Channel Stub
// ══════════════════════════════════════════

const pushChannelStub: NotificationDeliveryPort = {
  channel: 'push',
  async isEnabled(_tenantId: string) {
    // TODO: check if user has registered push subscription
    return false;
  },
  async deliver(notification) {
    // TODO: call edge function `send-push-notification`
    console.info('[PushChannel] stub — would push:', notification.title);
    return {
      channel: 'push',
      success: false,
      error: 'Push channel not yet implemented',
    };
  },
};

channelAdapters.set('push', pushChannelStub);

// ══════════════════════════════════════════
// Automation Hook (Runtime Engine integration)
// ══════════════════════════════════════════

export type AutomationTrigger = {
  notification: AppNotification;
  matched_rule_id: string;
  action: 'webhook' | 'edge_function' | 'slack' | 'custom';
  payload: Record<string, unknown>;
};

type AutomationHandler = (trigger: AutomationTrigger) => Promise<void>;

let automationHandler: AutomationHandler | null = null;

/**
 * Register the Runtime Engine's automation handler.
 * Called once at platform boot when automations module is active.
 */
export function registerAutomationHandler(handler: AutomationHandler): void {
  automationHandler = handler;
}

// ══════════════════════════════════════════
// Preference Cache (in-memory, per-session)
// ══════════════════════════════════════════

const prefsCache = new Map<string, UserNotificationPreferences>();

function getCacheKey(userId: string, tenantId: string): string {
  return `${tenantId}:${userId}`;
}

/**
 * Get user preferences. Falls back to defaults if not yet persisted.
 * TODO: load from `notification_preferences` table when created.
 */
export async function getUserPreferences(
  userId: string,
  tenantId: string,
): Promise<UserNotificationPreferences> {
  const key = getCacheKey(userId, tenantId);
  if (prefsCache.has(key)) return prefsCache.get(key)!;

  // TODO: fetch from DB
  // const { data } = await supabase
  //   .from('notification_preferences')
  //   .select('*')
  //   .eq('user_id', userId)
  //   .eq('tenant_id', tenantId)
  //   .single();

  const prefs = createDefaultPreferences(userId, tenantId);
  prefsCache.set(key, prefs);
  return prefs;
}

/**
 * Update user preferences (in-memory for now).
 * TODO: persist to `notification_preferences` table.
 */
export async function updateUserPreferences(
  prefs: UserNotificationPreferences,
): Promise<void> {
  const key = getCacheKey(prefs.user_id, prefs.tenant_id);
  prefs.updated_at = new Date().toISOString();
  prefsCache.set(key, prefs);

  // TODO: persist
  // await supabase
  //   .from('notification_preferences')
  //   .upsert(prefs);
}

// ══════════════════════════════════════════
// Orchestrator
// ══════════════════════════════════════════

/**
 * Route a notification to all applicable delivery channels.
 * Called after in-app notification is created.
 *
 * Flow:
 *   1. Resolve user preferences
 *   2. Determine which channels should fire
 *   3. Deliver to each channel in parallel
 *   4. Fire automation hook if registered
 */
export async function orchestrateDelivery(
  notification: AppNotification,
  recipientEmail?: string,
): Promise<DeliveryResult[]> {
  if (!notification.user_id) return [];

  const prefs = await getUserPreferences(
    notification.user_id,
    notification.tenant_id,
  );

  const channels = resolveDeliveryChannels(prefs, notification);

  // Deliver to all resolved channels in parallel (skip in_app, already done)
  const results = await Promise.allSettled(
    channels
      .filter(ch => ch !== 'in_app')
      .map(async ch => {
        const adapter = channelAdapters.get(ch);
        if (!adapter) return { channel: ch, success: false, error: 'No adapter' } as DeliveryResult;
        const enabled = await adapter.isEnabled(notification.tenant_id);
        if (!enabled) return { channel: ch, success: false, error: 'Channel disabled' } as DeliveryResult;
        return adapter.deliver(notification, recipientEmail);
      }),
  );

  const deliveryResults = results.map(r =>
    r.status === 'fulfilled' ? r.value : { channel: 'email' as DeliveryChannel, success: false, error: String(r.reason) },
  );

  // Fire automation hook (non-blocking)
  if (automationHandler) {
    // TODO: match notification against automation rules from Runtime Engine
    // For now, this is a no-op placeholder
  }

  return deliveryResults;
}
