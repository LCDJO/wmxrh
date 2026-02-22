/**
 * useEventQueue — React hook for the tenant event queue system.
 *
 * Provides publish, consume, ack/nack, and stats operations
 * against the tenant-event-queue edge function.
 */
import { useCallback, useState } from 'react';
import {
  type EventType,
  type EventPayload,
  type PublishEventOptions,
  type TenantEvent,
  type DeadLetterEntry,
  createPublishPayload,
} from './types';

interface UseEventQueueOptions {
  tenantId: string | null;
  consumerGroup?: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  retry: number;
  dead_letter: number;
  processed_last_5min: number;
  throughput_per_min: number;
  by_topic: Record<string, number>;
}

export function useEventQueue({ tenantId, consumerGroup = 'display_engine' }: UseEventQueueOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const base = `https://${projectId}.supabase.co/functions/v1/tenant-event-queue`;

  const call = useCallback(async (action: string, method: string, body?: any, params?: Record<string, string>) => {
    if (!tenantId) throw new Error('No tenant_id');
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ action, tenant_id: tenantId, ...params });
      const resp = await fetch(`${base}?${searchParams}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Request failed');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tenantId, base]);

  // Publish events
  const publish = useCallback(async (events: PublishEventOptions | PublishEventOptions[]) => {
    if (!tenantId) return null;
    const arr = Array.isArray(events) ? events : [events];
    const payloads = arr.map((e) => createPublishPayload(tenantId, e));
    return call('publish', 'POST', payloads);
  }, [tenantId, call]);

  // Consume pending events
  const consume = useCallback(async (options?: { topic?: string; domains?: string[]; limit?: number }) => {
    return call('consume', 'POST', {
      tenant_id: tenantId,
      consumer_group: consumerGroup,
      ...options,
    }) as Promise<{ events: TenantEvent[]; count: number; last_sequence: number }>;
  }, [tenantId, consumerGroup, call]);

  // Acknowledge events
  const ack = useCallback(async (eventIds: string[], topic?: string) => {
    return call('ack', 'POST', {
      event_ids: eventIds,
      tenant_id: tenantId,
      consumer_group: consumerGroup,
      topic,
    });
  }, [tenantId, consumerGroup, call]);

  // Negative acknowledge (retry/DLQ)
  const nack = useCallback(async (eventIds: string[], errorMessage?: string) => {
    return call('nack', 'POST', {
      event_ids: eventIds,
      tenant_id: tenantId,
      error_message: errorMessage,
    });
  }, [tenantId, call]);

  // Get queue stats
  const getStats = useCallback(async (): Promise<QueueStats> => {
    return call('stats', 'GET');
  }, [call]);

  // List dead-letter queue
  const getDLQ = useCallback(async (topic?: string): Promise<{ events: DeadLetterEntry[]; count: number }> => {
    const params: Record<string, string> = {};
    if (topic) params.topic = topic;
    return call('dlq', 'GET', undefined, params);
  }, [call]);

  // Reprocess DLQ events
  const reprocessDLQ = useCallback(async (dlqIds: string[]) => {
    return call('reprocess_dlq', 'POST', { dlq_ids: dlqIds, tenant_id: tenantId });
  }, [tenantId, call]);

  // Trigger retry processing
  const processRetries = useCallback(async () => {
    return call('retry', 'POST');
  }, [call]);

  // Trigger cleanup
  const cleanup = useCallback(async () => {
    return call('cleanup', 'POST');
  }, [call]);

  return {
    publish,
    consume,
    ack,
    nack,
    getStats,
    getDLQ,
    reprocessDLQ,
    processRetries,
    cleanup,
    loading,
    error,
  };
}
