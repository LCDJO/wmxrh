/**
 * eSocial Transmission Service
 *
 * Orchestrates end-to-end transmission with an async queue.
 *
 * Status lifecycle:  pending → sent → accepted | rejected
 *
 * Features:
 *   - Async queue with concurrency control
 *   - Automatic retry with exponential backoff
 *   - Batch grouping (max 50 per lote)
 *   - Rate limiting between batches
 *   - Priority queue support
 *   - Dead-letter tracking for exhausted retries
 */

import type { ESocialEnvelope, TransmissionStatus } from './types';
import { generateXML } from './xml-generator';
import { simulationSigner, type IDigitalSigner, type DigitalCertificate } from './digital-signer';
import { getTransmittableEnvelopes } from './transmission-controller';
import { processReturn, type GovernmentResponse } from './return-processor';

// ════════════════════════════════════
// TRANSMISSION STATUS (4 official states)
// ════════════════════════════════════

export type TransmissionItemStatus = 'pending' | 'sent' | 'accepted' | 'rejected';

// ════════════════════════════════════
// QUEUE ITEM
// ════════════════════════════════════

export interface QueueItem {
  id: string;
  envelope: ESocialEnvelope;
  status: TransmissionItemStatus;
  priority: 'high' | 'normal' | 'low';
  retry_count: number;
  max_retries: number;
  /** Timestamp when the item was enqueued */
  enqueued_at: string;
  /** Timestamp of last attempt */
  last_attempt_at: string | null;
  /** Scheduled time for next retry (null = immediate) */
  next_retry_at: string | null;
  /** Error from last attempt */
  last_error: string | null;
  /** Receipt from government (when accepted) */
  receipt_number: string | null;
}

// ════════════════════════════════════
// TRANSMISSION CONFIG
// ════════════════════════════════════

export interface TransmissionConfig {
  /** Max envelopes per batch (eSocial limit = 50) */
  batch_size: number;
  /** Delay between batches in ms */
  batch_delay_ms: number;
  /** Max retries for failed transmissions */
  max_retries: number;
  /** Base delay for exponential backoff in ms */
  retry_base_delay_ms: number;
  /** Max concurrent transmissions */
  concurrency: number;
  /** Transmission environment */
  environment: 'production' | 'restricted_production' | 'simulation';
}

const DEFAULT_CONFIG: TransmissionConfig = {
  batch_size: 50,
  batch_delay_ms: 1000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
  concurrency: 3,
  environment: 'simulation',
};

// ════════════════════════════════════
// GOVERNMENT API PORT
// ════════════════════════════════════

export interface IGovernmentAPI {
  send(signedXml: string, environment: string): Promise<GovernmentResponse>;
  queryReceipt(receiptNumber: string): Promise<GovernmentResponse>;
}

const simulationAPI: IGovernmentAPI = {
  async send(): Promise<GovernmentResponse> {
    const accepted = Math.random() > 0.1;
    await new Promise(r => setTimeout(r, 150 + Math.random() * 250));

    if (accepted) {
      return {
        status: 'accepted',
        receipt_number: `REC${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        protocol: `PROT${Date.now()}`,
        processed_at: new Date().toISOString(),
        events: [],
      };
    }
    return {
      status: 'rejected',
      receipt_number: null,
      protocol: null,
      processed_at: new Date().toISOString(),
      events: [{
        event_id: '',
        status: 'rejected',
        error_code: 'SIM_ERR_001',
        error_message: 'Erro simulado para teste de rejeição',
      }],
    };
  },

  async queryReceipt(receiptNumber: string): Promise<GovernmentResponse> {
    return {
      status: 'accepted',
      receipt_number: receiptNumber,
      protocol: `PROT_${receiptNumber}`,
      processed_at: new Date().toISOString(),
      events: [],
    };
  },
};

// ════════════════════════════════════
// BATCH RESULT
// ════════════════════════════════════

export interface TransmissionBatchResult {
  batch_id: string;
  total: number;
  accepted: number;
  rejected: number;
  errors: number;
  results: TransmissionItemResult[];
  started_at: string;
  completed_at: string;
}

export interface TransmissionItemResult {
  envelope_id: string;
  event_type: string;
  status: TransmissionItemStatus;
  receipt_number?: string;
  error_message?: string;
  xml_size_bytes: number;
  attempt: number;
}

// ════════════════════════════════════
// QUEUE EVENT CALLBACKS
// ════════════════════════════════════

export interface QueueCallbacks {
  onItemEnqueued?: (item: QueueItem) => void;
  onItemSent?: (item: QueueItem) => void;
  onItemAccepted?: (item: QueueItem) => void;
  onItemRejected?: (item: QueueItem) => void;
  onItemRetry?: (item: QueueItem, nextRetryAt: string) => void;
  onItemDeadLetter?: (item: QueueItem) => void;
  onBatchCompleted?: (result: TransmissionBatchResult) => void;
}

// ════════════════════════════════════
// TRANSMISSION SERVICE (with Async Queue)
// ════════════════════════════════════

export const transmissionService = {
  config: { ...DEFAULT_CONFIG } as TransmissionConfig,
  signer: simulationSigner as IDigitalSigner,
  api: simulationAPI as IGovernmentAPI,

  // ── Internal Queue State ──
  _queue: [] as QueueItem[],
  _deadLetter: [] as QueueItem[],
  _processing: false,
  _callbacks: {} as QueueCallbacks,

  // ── Configuration ──

  configure(config: Partial<TransmissionConfig>): void {
    Object.assign(this.config, config);
  },

  setSigner(signer: IDigitalSigner): void {
    this.signer = signer;
  },

  setAPI(api: IGovernmentAPI): void {
    this.api = api;
  },

  setCallbacks(callbacks: QueueCallbacks): void {
    this._callbacks = callbacks;
  },

  // ════════════════════════════════════
  // ASYNC QUEUE OPERATIONS
  // ════════════════════════════════════

  /**
   * Enqueue envelopes for async transmission.
   * Items start as `pending` in the queue.
   */
  enqueue(
    envelopes: ESocialEnvelope[],
    priority: QueueItem['priority'] = 'normal',
  ): QueueItem[] {
    const now = new Date().toISOString();
    const items: QueueItem[] = envelopes.map(env => ({
      id: `QI_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      envelope: env,
      status: 'pending' as TransmissionItemStatus,
      priority,
      retry_count: 0,
      max_retries: this.config.max_retries,
      enqueued_at: now,
      last_attempt_at: null,
      next_retry_at: null,
      last_error: null,
      receipt_number: null,
    }));

    // Insert by priority: high → front, low → back
    for (const item of items) {
      if (item.priority === 'high') {
        const firstNonHigh = this._queue.findIndex(q => q.priority !== 'high');
        if (firstNonHigh === -1) {
          this._queue.push(item);
        } else {
          this._queue.splice(firstNonHigh, 0, item);
        }
      } else if (item.priority === 'low') {
        this._queue.push(item);
      } else {
        // normal → after high, before low
        const firstLow = this._queue.findIndex(q => q.priority === 'low');
        if (firstLow === -1) {
          this._queue.push(item);
        } else {
          this._queue.splice(firstLow, 0, item);
        }
      }
      this._callbacks.onItemEnqueued?.(item);
    }

    return items;
  },

  /**
   * Process the queue asynchronously.
   * Picks items in priority order, processes in batches with concurrency control.
   */
  async processQueue(certificate: DigitalCertificate): Promise<TransmissionBatchResult> {
    if (this._processing) {
      throw new Error('Fila já está sendo processada');
    }
    this._processing = true;

    const startedAt = new Date().toISOString();
    const results: TransmissionItemResult[] = [];

    try {
      // Get all items ready to be sent
      const ready = this._getReadyItems();

      // Process in batches
      for (let i = 0; i < ready.length; i += this.config.batch_size) {
        const batch = ready.slice(i, i + this.config.batch_size);

        // Process batch with concurrency limit
        const batchResults = await this._processBatchConcurrent(batch, certificate);
        results.push(...batchResults);

        // Rate limiting between batches
        if (i + this.config.batch_size < ready.length) {
          await new Promise(r => setTimeout(r, this.config.batch_delay_ms));
        }
      }
    } finally {
      this._processing = false;
    }

    const batchResult: TransmissionBatchResult = {
      batch_id: `BATCH_${Date.now()}`,
      total: results.length,
      accepted: results.filter(r => r.status === 'accepted').length,
      rejected: results.filter(r => r.status === 'rejected').length,
      errors: results.filter(r => r.status === 'pending').length, // still pending = error
      results,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };

    this._callbacks.onBatchCompleted?.(batchResult);
    return batchResult;
  },

  /**
   * Retry all eligible rejected/failed items in the queue.
   */
  async retryFailed(certificate: DigitalCertificate): Promise<TransmissionBatchResult> {
    const now = new Date();
    // Re-enqueue items whose retry time has passed
    for (const item of this._queue) {
      if (
        item.status === 'rejected' &&
        item.retry_count < item.max_retries &&
        (!item.next_retry_at || new Date(item.next_retry_at) <= now)
      ) {
        item.status = 'pending';
      }
    }
    return this.processQueue(certificate);
  },

  // ── Queue Inspection ──

  getQueueSnapshot(): {
    pending: number;
    sent: number;
    accepted: number;
    rejected: number;
    dead_letter: number;
    total: number;
    items: QueueItem[];
  } {
    return {
      pending: this._queue.filter(i => i.status === 'pending').length,
      sent: this._queue.filter(i => i.status === 'sent').length,
      accepted: this._queue.filter(i => i.status === 'accepted').length,
      rejected: this._queue.filter(i => i.status === 'rejected').length,
      dead_letter: this._deadLetter.length,
      total: this._queue.length,
      items: [...this._queue],
    };
  },

  getDeadLetterItems(): QueueItem[] {
    return [...this._deadLetter];
  },

  /**
   * Clear completed (accepted) items from the queue.
   */
  purgeCompleted(): number {
    const before = this._queue.length;
    this._queue = this._queue.filter(i => i.status !== 'accepted');
    return before - this._queue.length;
  },

  /**
   * Clear entire queue (use with caution).
   */
  clearQueue(): void {
    this._queue = [];
    this._deadLetter = [];
  },

  // ════════════════════════════════════
  // DIRECT TRANSMISSION (non-queued)
  // ════════════════════════════════════

  /**
   * Transmit a batch directly (bypassing queue).
   */
  async transmitBatch(
    envelopes: ESocialEnvelope[],
    certificate: DigitalCertificate,
  ): Promise<TransmissionBatchResult> {
    const items = this.enqueue(envelopes);
    return this.processQueue(certificate);
  },

  /**
   * Transmit a single envelope directly.
   */
  async transmitSingle(
    envelope: ESocialEnvelope,
    certificate: DigitalCertificate,
  ): Promise<TransmissionItemResult> {
    const [item] = this.enqueue([envelope], 'high');
    const result = await this._processItem(item, certificate);
    return result;
  },

  // ════════════════════════════════════
  // STATISTICS
  // ════════════════════════════════════

  getStats(results: TransmissionBatchResult[]): {
    total_transmitted: number;
    total_accepted: number;
    total_rejected: number;
    total_errors: number;
    acceptance_rate: number;
    avg_xml_size: number;
  } {
    let total = 0, accepted = 0, rejected = 0, errors = 0, totalSize = 0;

    for (const batch of results) {
      total += batch.total;
      accepted += batch.accepted;
      rejected += batch.rejected;
      errors += batch.errors;
      totalSize += batch.results.reduce((s, r) => s + r.xml_size_bytes, 0);
    }

    return {
      total_transmitted: total,
      total_accepted: accepted,
      total_rejected: rejected,
      total_errors: errors,
      acceptance_rate: total > 0 ? (accepted / total) * 100 : 0,
      avg_xml_size: total > 0 ? Math.round(totalSize / total) : 0,
    };
  },

  // ════════════════════════════════════
  // INTERNAL — Queue Processing
  // ════════════════════════════════════

  _getReadyItems(): QueueItem[] {
    const now = new Date();
    return this._queue.filter(item =>
      item.status === 'pending' &&
      (!item.next_retry_at || new Date(item.next_retry_at) <= now)
    );
  },

  async _processBatchConcurrent(
    items: QueueItem[],
    certificate: DigitalCertificate,
  ): Promise<TransmissionItemResult[]> {
    const results: TransmissionItemResult[] = [];

    // Process with concurrency limit
    for (let i = 0; i < items.length; i += this.config.concurrency) {
      const chunk = items.slice(i, i + this.config.concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(item => this._processItem(item, certificate))
      );

      for (const settled of chunkResults) {
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        }
      }
    }

    return results;
  },

  async _processItem(
    item: QueueItem,
    certificate: DigitalCertificate,
  ): Promise<TransmissionItemResult> {
    const now = new Date().toISOString();
    item.last_attempt_at = now;

    try {
      // 1. pending → sent
      item.status = 'sent';
      this._callbacks.onItemSent?.(item);

      // 2. Generate XML
      const xmlResult = generateXML(item.envelope);

      // 3. Sign
      const signResult = await this.signer.sign(xmlResult.xml, certificate);

      // 4. Send to government
      const govResponse = await this.api.send(signResult.signed_xml, this.config.environment);

      // 5. Process return → accepted | rejected
      const processed = processReturn(item.envelope, govResponse);

      if (processed.new_status === 'accepted') {
        item.status = 'accepted';
        item.receipt_number = processed.receipt_number;
        this._callbacks.onItemAccepted?.(item);
      } else {
        item.status = 'rejected';
        item.last_error = processed.errors[0] || 'Rejeitado pelo governo';
        item.retry_count++;
        this._scheduleRetry(item);
        this._callbacks.onItemRejected?.(item);
      }

      return {
        envelope_id: item.envelope.id,
        event_type: item.envelope.event_type,
        status: item.status,
        receipt_number: item.receipt_number ?? undefined,
        error_message: item.last_error ?? undefined,
        xml_size_bytes: xmlResult.size_bytes,
        attempt: item.retry_count,
      };
    } catch (err) {
      // Network/technical error → stays as rejected for retry
      item.status = 'rejected';
      item.last_error = err instanceof Error ? err.message : 'Erro desconhecido';
      item.retry_count++;
      this._scheduleRetry(item);

      return {
        envelope_id: item.envelope.id,
        event_type: item.envelope.event_type,
        status: 'rejected',
        error_message: item.last_error,
        xml_size_bytes: 0,
        attempt: item.retry_count,
      };
    }
  },

  /**
   * Schedule retry with exponential backoff, or move to dead letter.
   */
  _scheduleRetry(item: QueueItem): void {
    if (item.retry_count >= item.max_retries) {
      // Exhausted retries → dead letter
      this._queue = this._queue.filter(q => q.id !== item.id);
      this._deadLetter.push(item);
      this._callbacks.onItemDeadLetter?.(item);
      return;
    }

    // Exponential backoff: base * 2^attempt (e.g. 2s, 4s, 8s)
    const delay = this.config.retry_base_delay_ms * Math.pow(2, item.retry_count - 1);
    const nextRetry = new Date(Date.now() + delay).toISOString();
    item.next_retry_at = nextRetry;
    // Reset to pending so it's picked up on next processQueue
    item.status = 'pending';
    this._callbacks.onItemRetry?.(item, nextRetry);
  },
};
