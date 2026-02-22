/**
 * useDisplayEventQueue — Enterprise event buffer with deduplication & backpressure.
 *
 * Features:
 *   ✅ Deduplicates events by ID before merging into state
 *   ✅ Batches rapid updates (configurable flush interval)
 *   ✅ Backpressure: drops oldest events when buffer exceeds max size
 *   ✅ Tracks connection quality (latency, dropped events)
 *   ✅ Works with both Realtime and polling sources
 */
import { useCallback, useRef, useState, useEffect } from 'react';

export interface QueuedEvent {
  id: string;
  source: 'realtime' | 'poll';
  timestamp: string;
  payload: any;
}

export interface QueueStats {
  buffered: number;
  totalProcessed: number;
  totalDropped: number;
  avgLatencyMs: number;
  lastFlushAt: Date | null;
}

interface UseDisplayEventQueueOptions {
  maxBufferSize?: number;
  flushIntervalMs?: number;
  onFlush?: (events: QueuedEvent[]) => void;
}

export function useDisplayEventQueue(options: UseDisplayEventQueueOptions = {}) {
  const {
    maxBufferSize = 500,
    flushIntervalMs = 300,
    onFlush,
  } = options;

  const bufferRef = useRef<Map<string, QueuedEvent>>(new Map());
  const statsRef = useRef({ totalProcessed: 0, totalDropped: 0, latencySum: 0, latencyCount: 0 });
  const [stats, setStats] = useState<QueueStats>({
    buffered: 0,
    totalProcessed: 0,
    totalDropped: 0,
    avgLatencyMs: 0,
    lastFlushAt: null,
  });
  const flushTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Enqueue an event (dedup by ID, backpressure on overflow)
  const enqueue = useCallback((event: QueuedEvent) => {
    const buffer = bufferRef.current;

    // Dedup: overwrite existing event with same ID
    buffer.set(event.id, event);

    // Backpressure: drop oldest events if buffer exceeds max
    if (buffer.size > maxBufferSize) {
      const toDelete = buffer.size - maxBufferSize;
      const iterator = buffer.keys();
      for (let i = 0; i < toDelete; i++) {
        const key = iterator.next().value;
        if (key) buffer.delete(key);
        statsRef.current.totalDropped++;
      }
    }

    // Track latency
    const eventTime = new Date(event.timestamp).getTime();
    if (!isNaN(eventTime)) {
      const latency = Date.now() - eventTime;
      statsRef.current.latencySum += latency;
      statsRef.current.latencyCount++;
    }
  }, [maxBufferSize]);

  // Enqueue a batch of events
  const enqueueBatch = useCallback((events: QueuedEvent[]) => {
    events.forEach(enqueue);
  }, [enqueue]);

  // Flush buffer and notify consumer
  const flush = useCallback(() => {
    const buffer = bufferRef.current;
    if (buffer.size === 0) return;

    const events = Array.from(buffer.values());
    buffer.clear();

    statsRef.current.totalProcessed += events.length;
    const s = statsRef.current;

    setStats({
      buffered: 0,
      totalProcessed: s.totalProcessed,
      totalDropped: s.totalDropped,
      avgLatencyMs: s.latencyCount > 0 ? Math.round(s.latencySum / s.latencyCount) : 0,
      lastFlushAt: new Date(),
    });

    onFlush?.(events);
  }, [onFlush]);

  // Periodic flush
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      flush();
      // Update buffered count
      setStats(prev => ({ ...prev, buffered: bufferRef.current.size }));
    }, flushIntervalMs);

    return () => clearInterval(flushTimerRef.current);
  }, [flush, flushIntervalMs]);

  const getBufferSize = useCallback(() => bufferRef.current.size, []);

  return { enqueue, enqueueBatch, flush, stats, getBufferSize };
}
