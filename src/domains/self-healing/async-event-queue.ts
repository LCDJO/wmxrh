/**
 * AsyncEventQueue — Internal async queue for GlobalEventKernel.
 *
 * Processes events asynchronously via microtask scheduling to avoid
 * blocking the main thread during high-frequency event bursts.
 * Supports priority ordering (critical > high > normal > low).
 */

import type { EventPriority } from '@/domains/platform-os/types';

// ── Queue item ─────────────────────────────────────────────────

interface QueueItem {
  handler: () => void;
  priority: EventPriority;
  enqueued_at: number;
}

const PRIORITY_WEIGHT: Record<EventPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── Queue implementation ───────────────────────────────────────

export class AsyncEventQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private batchSize: number;
  private stats = { processed: 0, dropped: 0, max_queue_depth: 0 };

  constructor(
    private readonly maxSize = 10_000,
    batchSize = 50,
  ) {
    this.batchSize = batchSize;
  }

  /** Enqueue handler for async execution. Returns false if queue is full. */
  enqueue(handler: () => void, priority: EventPriority = 'normal'): boolean {
    if (this.queue.length >= this.maxSize) {
      this.stats.dropped++;
      return false;
    }

    this.queue.push({ handler, priority, enqueued_at: Date.now() });
    if (this.queue.length > this.stats.max_queue_depth) {
      this.stats.max_queue_depth = this.queue.length;
    }

    if (!this.processing) {
      this.scheduleFlush();
    }
    return true;
  }

  /** Current queue depth. */
  get depth(): number {
    return this.queue.length;
  }

  /** Queue statistics. */
  getStats() {
    return { ...this.stats, current_depth: this.queue.length };
  }

  /** Drain all pending items synchronously (for shutdown). */
  drain(): void {
    this.sortByPriority();
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try { item.handler(); } catch { /* swallow */ }
      this.stats.processed++;
    }
  }

  // ── Internal ──────────────────────────────────────────────────

  private scheduleFlush(): void {
    this.processing = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.sortByPriority();

    let processed = 0;
    while (this.queue.length > 0 && processed < this.batchSize) {
      const item = this.queue.shift()!;
      try { item.handler(); } catch { /* swallow */ }
      this.stats.processed++;
      processed++;
    }

    if (this.queue.length > 0) {
      // Yield and continue in next microtask
      this.scheduleFlush();
    } else {
      this.processing = false;
    }
  }

  private sortByPriority(): void {
    this.queue.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);
  }
}
