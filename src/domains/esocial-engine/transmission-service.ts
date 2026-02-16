/**
 * eSocial Transmission Service
 *
 * Orchestrates the end-to-end transmission pipeline:
 *   1. Select transmittable envelopes
 *   2. Generate XML
 *   3. Sign digitally
 *   4. Send to government endpoint
 *   5. Process return
 *   6. Update status
 *
 * Uses Port/Adapter pattern for government API communication.
 * Includes retry logic, rate limiting, and batch control.
 */

import type { ESocialEnvelope, TransmissionResult, TransmissionStatus } from './types';
import { generateXML, type XMLGenerationResult } from './xml-generator';
import { simulationSigner, type IDigitalSigner, type DigitalCertificate } from './digital-signer';
import { transitionEnvelope, getTransmittableEnvelopes } from './transmission-controller';
import { processReturn, type GovernmentResponse } from './return-processor';

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
  /** Transmission environment */
  environment: 'production' | 'restricted_production' | 'simulation';
}

const DEFAULT_CONFIG: TransmissionConfig = {
  batch_size: 50,
  batch_delay_ms: 1000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
  environment: 'simulation',
};

// ════════════════════════════════════
// GOVERNMENT API PORT
// ════════════════════════════════════

export interface IGovernmentAPI {
  /** Send signed XML batch to government endpoint */
  send(signedXml: string, environment: string): Promise<GovernmentResponse>;
  /** Query receipt/protocol status */
  queryReceipt(receiptNumber: string): Promise<GovernmentResponse>;
}

/** Simulation adapter for development */
const simulationAPI: IGovernmentAPI = {
  async send(signedXml: string): Promise<GovernmentResponse> {
    // Simulate 90% acceptance rate
    const accepted = Math.random() > 0.1;
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

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
// TRANSMISSION PIPELINE
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
  status: 'accepted' | 'rejected' | 'error';
  receipt_number?: string;
  error_message?: string;
  xml_size_bytes: number;
}

/**
 * Main transmission orchestrator.
 */
export const transmissionService = {
  config: { ...DEFAULT_CONFIG } as TransmissionConfig,
  signer: simulationSigner as IDigitalSigner,
  api: simulationAPI as IGovernmentAPI,

  /**
   * Configure the transmission service.
   */
  configure(config: Partial<TransmissionConfig>): void {
    Object.assign(this.config, config);
  },

  /**
   * Inject a real signer adapter (e.g., HSM-backed).
   */
  setSigner(signer: IDigitalSigner): void {
    this.signer = signer;
  },

  /**
   * Inject a real government API adapter.
   */
  setAPI(api: IGovernmentAPI): void {
    this.api = api;
  },

  /**
   * Transmit a batch of queued envelopes.
   */
  async transmitBatch(
    envelopes: ESocialEnvelope[],
    certificate: DigitalCertificate,
  ): Promise<TransmissionBatchResult> {
    const startedAt = new Date().toISOString();
    const transmittable = getTransmittableEnvelopes(envelopes);
    const results: TransmissionItemResult[] = [];

    // Process in batches
    for (let i = 0; i < transmittable.length; i += this.config.batch_size) {
      const batch = transmittable.slice(i, i + this.config.batch_size);

      for (const envelope of batch) {
        const result = await this.transmitSingle(envelope, certificate);
        results.push(result);
      }

      // Rate limiting between batches
      if (i + this.config.batch_size < transmittable.length) {
        await new Promise(r => setTimeout(r, this.config.batch_delay_ms));
      }
    }

    const accepted = results.filter(r => r.status === 'accepted').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    const errors = results.filter(r => r.status === 'error').length;

    return {
      batch_id: `BATCH_${Date.now()}`,
      total: results.length,
      accepted,
      rejected,
      errors,
      results,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  },

  /**
   * Transmit a single envelope through the full pipeline.
   */
  async transmitSingle(
    envelope: ESocialEnvelope,
    certificate: DigitalCertificate,
  ): Promise<TransmissionItemResult> {
    try {
      // 1. Generate XML
      const xmlResult = generateXML(envelope);

      // 2. Sign
      const signResult = await this.signer.sign(xmlResult.xml, certificate);

      // 3. Send
      const govResponse = await this.api.send(
        signResult.signed_xml,
        this.config.environment,
      );

      // 4. Process return
      const processed = processReturn(envelope, govResponse);

      return {
        envelope_id: envelope.id,
        event_type: envelope.event_type,
        status: processed.new_status === 'accepted' ? 'accepted' : 'rejected',
        receipt_number: processed.receipt_number ?? undefined,
        error_message: processed.errors.length > 0 ? processed.errors[0] : undefined,
        xml_size_bytes: xmlResult.size_bytes,
      };
    } catch (err) {
      return {
        envelope_id: envelope.id,
        event_type: envelope.event_type,
        status: 'error',
        error_message: err instanceof Error ? err.message : 'Erro desconhecido na transmissão',
        xml_size_bytes: 0,
      };
    }
  },

  /**
   * Retry failed envelopes with exponential backoff.
   */
  async retryFailed(
    failedEnvelopes: ESocialEnvelope[],
    certificate: DigitalCertificate,
  ): Promise<TransmissionBatchResult> {
    const eligible = failedEnvelopes.filter(
      e => (e.status === 'error' || e.status === 'rejected') && e.retry_count < this.config.max_retries,
    );
    return this.transmitBatch(
      eligible.map(e => ({ ...e, status: 'queued' as TransmissionStatus })),
      certificate,
    );
  },

  /**
   * Get transmission statistics.
   */
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
};
