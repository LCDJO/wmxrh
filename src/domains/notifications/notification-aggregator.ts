/**
 * NotificationAggregator
 *
 * Prevents notification spam by batching similar events within a time window.
 *
 * Strategy:
 *   - Each notification gets an aggregation key (source_module + type + scope)
 *   - Events with the same key within WINDOW_MS are merged into a single notification
 *   - After the window expires, the aggregated notification is dispatched
 *
 * Example:
 *   5× EmployeeHired in 30s → "5 novos funcionários adicionados"
 */

import { notificationDispatcher, type CreateNotificationDTO } from './notification-hub';

// ══════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════

/** Time window in ms to aggregate similar notifications */
const WINDOW_MS = 30_000; // 30 seconds

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface AggregationRule {
  /** Unique key for grouping — same key = same bucket */
  key: string;
  /** Template for aggregated title. `{count}` is replaced with the count */
  titleTemplate: string;
  /** Template for aggregated description. `{count}` replaced */
  descriptionTemplate: string;
  /** Base DTO used for the aggregated notification */
  baseDto: CreateNotificationDTO;
}

interface AggregationBucket {
  rule: AggregationRule;
  count: number;
  /** Per-recipient counts */
  recipientCounts: Map<string, number>;
  timer: ReturnType<typeof setTimeout>;
  firstAt: number;
}

// ══════════════════════════════════════════════════════════════
// Predefined aggregation rules per event type
// ══════════════════════════════════════════════════════════════

export const AGGREGATION_TEMPLATES: Record<string, {
  titleTemplate: string;
  descriptionTemplate: string;
}> = {
  EmployeeHired: {
    titleTemplate: '{count} novos funcionários adicionados',
    descriptionTemplate: '{count} contratações realizadas recentemente.',
  },
  SalaryAdjusted: {
    titleTemplate: '{count} ajustes salariais realizados',
    descriptionTemplate: '{count} salários foram ajustados.',
  },
  AdditionalAdded: {
    titleTemplate: '{count} adicionais registrados',
    descriptionTemplate: '{count} novos adicionais foram incluídos.',
  },
  JobPositionChanged: {
    titleTemplate: '{count} mudanças de cargo',
    descriptionTemplate: '{count} alterações de cargo realizadas.',
  },
  EmployeeStatusChanged: {
    titleTemplate: '{count} alterações de status',
    descriptionTemplate: '{count} funcionários tiveram status atualizado.',
  },
  RolePermissionsUpdated: {
    titleTemplate: '{count} permissões alteradas',
    descriptionTemplate: '{count} atualizações de permissões realizadas.',
  },
};

// ══════════════════════════════════════════════════════════════
// Aggregator
// ══════════════════════════════════════════════════════════════

const buckets = new Map<string, AggregationBucket>();

export const notificationAggregator = {
  /**
   * Submit a notification for possible aggregation.
   *
   * @param eventType - The event type (e.g., 'EmployeeHired')
   * @param dto       - The notification DTO to send
   * @param recipientIds - If provided, tracks per-recipient counts
   * @returns true if aggregated (will fire later), false if sent immediately
   */
  submit(
    eventType: string,
    dto: CreateNotificationDTO,
    recipientIds?: string[],
  ): boolean {
    const template = AGGREGATION_TEMPLATES[eventType];

    // No aggregation rule → dispatch immediately
    if (!template) return false;

    const key = buildKey(eventType, dto);
    const existing = buckets.get(key);

    if (existing) {
      // Increment existing bucket
      existing.count += 1;
      if (recipientIds) {
        for (const uid of recipientIds) {
          existing.recipientCounts.set(uid, (existing.recipientCounts.get(uid) || 0) + 1);
        }
      }
      return true;
    }

    // Create new bucket
    const bucket: AggregationBucket = {
      rule: {
        key,
        titleTemplate: template.titleTemplate,
        descriptionTemplate: template.descriptionTemplate,
        baseDto: { ...dto },
      },
      count: 1,
      recipientCounts: new Map(),
      firstAt: Date.now(),
      timer: setTimeout(() => flush(key), WINDOW_MS),
    };

    if (recipientIds) {
      for (const uid of recipientIds) {
        bucket.recipientCounts.set(uid, 1);
      }
    }

    buckets.set(key, bucket);
    return true;
  },

  /** Force flush all pending buckets (useful for testing / shutdown) */
  flushAll() {
    for (const key of Array.from(buckets.keys())) {
      flush(key);
    }
  },

  /** Number of pending aggregation buckets */
  get pendingCount() {
    return buckets.size;
  },
};

// ══════════════════════════════════════════════════════════════
// Internal
// ══════════════════════════════════════════════════════════════

function buildKey(eventType: string, dto: CreateNotificationDTO): string {
  return `${dto.tenant_id}:${dto.source_module || ''}:${eventType}:${dto.company_id || ''}:${dto.group_id || ''}`;
}

function flush(key: string) {
  const bucket = buckets.get(key);
  if (!bucket) return;

  clearTimeout(bucket.timer);
  buckets.delete(key);

  const { rule, count, recipientCounts } = bucket;
  const title = rule.titleTemplate.replace('{count}', String(count));
  const description = rule.descriptionTemplate.replace('{count}', String(count));

  if (recipientCounts.size > 0) {
    // Send one aggregated notification per recipient
    for (const [userId] of recipientCounts) {
      notificationDispatcher.create({
        ...rule.baseDto,
        user_id: userId,
        title,
        description,
      }).catch(err => {
        console.warn('[NotificationAggregator] flush failed:', err);
      });
    }
  } else {
    // Single recipient from baseDto
    notificationDispatcher.create({
      ...rule.baseDto,
      title,
      description,
    }).catch(err => {
      console.warn('[NotificationAggregator] flush failed:', err);
    });
  }
}
