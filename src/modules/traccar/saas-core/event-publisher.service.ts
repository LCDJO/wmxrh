/**
 * EventPublisherService — Publicação de eventos Traccar normalizados na fila.
 *
 * Ponte entre a ingestão de dados (SaaS Core) e o processamento
 * pela camada Tenant Fleet Intelligence.
 */
import {
  createPublishPayload,
  EVENT_TYPES,
  EVENT_DOMAINS,
  EVENT_PRIORITIES,
} from '@/domains/event-queue';
import type { EventPriority } from '@/domains/event-queue';

export interface TraccarEventPublishPayload {
  tenantId: string;
  deviceId: string;
  eventType: 'position_update' | 'device_event' | 'speed_violation' | 'geofence_breach';
  data: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Cria payload normalizado para publicação na fila de eventos.
 */
export function publishTraccarEvent(payload: TraccarEventPublishPayload) {
  const eventTypeMap: Record<string, string> = {
    position_update: EVENT_TYPES.TRACKING_EVENT,
    device_event: EVENT_TYPES.TRACKING_EVENT,
    speed_violation: EVENT_TYPES.BEHAVIOR_EVENT,
    geofence_breach: EVENT_TYPES.BEHAVIOR_EVENT,
  };

  const priorityMap: Record<string, EventPriority> = {
    position_update: EVENT_PRIORITIES.LOW,
    device_event: EVENT_PRIORITIES.NORMAL,
    speed_violation: EVENT_PRIORITIES.HIGH,
    geofence_breach: EVENT_PRIORITIES.HIGH,
  };

  return createPublishPayload(payload.tenantId, {
    event_type: (eventTypeMap[payload.eventType] || EVENT_TYPES.TRACKING_EVENT) as any,
    domain: EVENT_DOMAINS.FLEET,
    payload: {
      device_id: payload.deviceId,
      ...payload.data,
    } as any,
    priority: priorityMap[payload.eventType] || EVENT_PRIORITIES.NORMAL,
  });
}

/**
 * Publicação em lote de eventos Traccar normalizados.
 */
export function publishBatchTraccarEvents(payloads: TraccarEventPublishPayload[]) {
  return payloads.map(publishTraccarEvent);
}
