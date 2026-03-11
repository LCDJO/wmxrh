/**
 * Global Event Kernel — Lightweight in-memory pub/sub for domain events.
 *
 * All domain events flow through this kernel for cross-domain reactivity,
 * audit trail, and observability bridging.
 */

export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  source: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

type EventHandler<T = unknown> = (event: DomainEvent<T>) => void;

class EventKernel {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private history: DomainEvent[] = [];
  private readonly MAX_HISTORY = 500;

  emit<T>(event: DomainEvent<T>): void {
    // Append to history ring-buffer
    this.history.push(event);
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }

    // Notify subscribers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(event); } catch (err) {
          console.error(`[EventKernel] handler error for ${event.type}:`, err);
        }
      });
    }

    // Wildcard listeners
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(fn => {
        try { fn(event); } catch (err) {
          console.error('[EventKernel] wildcard handler error:', err);
        }
      });
    }
  }

  on<T>(type: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  getHistory(type?: string, limit = 50): DomainEvent[] {
    const filtered = type
      ? this.history.filter(e => e.type === type)
      : this.history;
    return filtered.slice(-limit);
  }

  clear(): void {
    this.handlers.clear();
    this.history = [];
  }
}

export const eventKernel = new EventKernel();
