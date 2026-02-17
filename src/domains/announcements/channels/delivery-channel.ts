/**
 * DeliveryChannel — Contracts for multi-channel announcement delivery.
 *
 * Supported channels (future):
 *   - in_app   → Current implementation (banners, cards, badges)
 *   - email    → Transactional email via provider
 *   - whatsapp → WhatsApp Business API
 *   - push     → Web Push / Mobile Push notifications
 *
 * Each channel implements the DeliveryChannel interface and is
 * registered in the ChannelOrchestrator.
 */

import type { TenantAnnouncement } from '../announcement-hub';

// ══════════════════════════════════════════════════════════════
// Channel Types
// ══════════════════════════════════════════════════════════════

export type DeliveryChannelType = 'in_app' | 'email' | 'whatsapp' | 'push';

export interface DeliveryRecipient {
  user_id: string;
  tenant_id: string;
  email?: string;
  phone?: string;
  push_token?: string;
  locale?: string;
}

export interface DeliveryResult {
  channel: DeliveryChannelType;
  recipient_id: string;
  success: boolean;
  external_id?: string;
  error?: string;
  delivered_at?: string;
}

export interface DeliveryOptions {
  /** Skip sending if user already received this announcement via this channel */
  deduplicate?: boolean;
  /** Schedule delivery for later */
  scheduled_at?: string;
  /** Priority: high = immediate, normal = batched */
  priority?: 'high' | 'normal' | 'low';
  /** Template override for the channel */
  template_id?: string;
}

// ══════════════════════════════════════════════════════════════
// Channel Interface
// ══════════════════════════════════════════════════════════════

export interface DeliveryChannel {
  readonly type: DeliveryChannelType;
  readonly name: string;

  /** Check if this channel is enabled and configured */
  isAvailable(): Promise<boolean>;

  /** Check if a specific recipient can receive via this channel */
  canDeliver(recipient: DeliveryRecipient): boolean;

  /** Send announcement to a single recipient */
  send(
    announcement: TenantAnnouncement,
    recipient: DeliveryRecipient,
    options?: DeliveryOptions,
  ): Promise<DeliveryResult>;

  /** Send announcement to multiple recipients (batch) */
  sendBatch(
    announcement: TenantAnnouncement,
    recipients: DeliveryRecipient[],
    options?: DeliveryOptions,
  ): Promise<DeliveryResult[]>;
}

// ══════════════════════════════════════════════════════════════
// Channel Orchestrator — Registry & Fan-out
// ══════════════════════════════════════════════════════════════

export interface ChannelPreference {
  channel: DeliveryChannelType;
  enabled: boolean;
  /** Minimum severity to trigger this channel */
  min_severity?: 'info' | 'warning' | 'critical';
}

export interface ChannelOrchestrator {
  /** Register a channel implementation */
  register(channel: DeliveryChannel): void;

  /** Get all registered channels */
  getChannels(): DeliveryChannel[];

  /** Deliver an announcement through all applicable channels */
  deliver(
    announcement: TenantAnnouncement,
    recipients: DeliveryRecipient[],
    preferences?: ChannelPreference[],
    options?: DeliveryOptions,
  ): Promise<DeliveryResult[]>;
}

// ══════════════════════════════════════════════════════════════
// Default severity → channel mapping
// ══════════════════════════════════════════════════════════════

export const DEFAULT_CHANNEL_RULES: Record<string, DeliveryChannelType[]> = {
  info: ['in_app'],
  warning: ['in_app', 'email'],
  critical: ['in_app', 'email', 'whatsapp', 'push'],
};

// ══════════════════════════════════════════════════════════════
// Stub orchestrator (for future implementation)
// ══════════════════════════════════════════════════════════════

export function createChannelOrchestrator(): ChannelOrchestrator {
  const channels = new Map<DeliveryChannelType, DeliveryChannel>();

  return {
    register(channel) {
      channels.set(channel.type, channel);
    },

    getChannels() {
      return Array.from(channels.values());
    },

    async deliver(announcement, recipients, preferences, options) {
      const severity = announcement.severity;
      const applicableTypes = DEFAULT_CHANNEL_RULES[severity] ?? ['in_app'];

      const results: DeliveryResult[] = [];

      for (const channelType of applicableTypes) {
        const channel = channels.get(channelType);
        if (!channel) continue;

        // Check preference overrides
        const pref = preferences?.find(p => p.channel === channelType);
        if (pref && !pref.enabled) continue;

        const eligible = recipients.filter(r => channel.canDeliver(r));
        if (eligible.length === 0) continue;

        try {
          const batchResults = await channel.sendBatch(announcement, eligible, options);
          results.push(...batchResults);
        } catch (err) {
          console.error(`[ChannelOrchestrator] ${channelType} batch failed:`, err);
          results.push(
            ...eligible.map(r => ({
              channel: channelType,
              recipient_id: r.user_id,
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error',
            })),
          );
        }
      }

      return results;
    },
  };
}
