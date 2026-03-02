/**
 * REPCTechnicalLog — Log técnico append-only com chain de integridade.
 * Portaria 671/2021 Art. 75-77 — Registro de todas as operações do REP-C.
 */

import type { REPCLogEntry, REPCLogEventType } from './types';

export class REPCTechnicalLog {
  private entries: REPCLogEntry[] = [];

  log(
    tenantId: string,
    event: {
      event_type: REPCLogEventType;
      nsr?: number;
      description: string;
      actor_id?: string;
      actor_cpf?: string;
      ip_address?: string;
      metadata?: Record<string, unknown>;
    },
  ): REPCLogEntry {
    const now = new Date().toISOString();
    const previousHash = this.entries.length > 0
      ? this.entries[this.entries.length - 1].integrity_hash
      : null;

    const entry: REPCLogEntry = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      timestamp: now,
      server_timestamp: now,
      event_type: event.event_type,
      nsr: event.nsr,
      description: event.description,
      actor_id: event.actor_id,
      actor_cpf: event.actor_cpf,
      ip_address: event.ip_address,
      metadata: event.metadata,
      integrity_hash: '',
      previous_hash: previousHash,
    };

    // Compute integrity hash (FNV-1a)
    const payload = `${entry.tenant_id}|${entry.timestamp}|${entry.event_type}|${entry.description}|${previousHash ?? 'genesis'}`;
    entry.integrity_hash = this.fnv1a(payload);

    this.entries.push(entry);
    return entry;
  }

  getEntries(tenantId: string, from: string, to: string): REPCLogEntry[] {
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();
    return this.entries.filter(e =>
      e.tenant_id === tenantId &&
      new Date(e.timestamp).getTime() >= fromTs &&
      new Date(e.timestamp).getTime() <= toTs,
    );
  }

  verifyChain(tenantId: string): { valid: boolean; broken_at?: string } {
    const tenantEntries = this.entries.filter(e => e.tenant_id === tenantId);

    for (let i = 1; i < tenantEntries.length; i++) {
      if (tenantEntries[i].previous_hash !== tenantEntries[i - 1].integrity_hash) {
        return { valid: false, broken_at: tenantEntries[i].id };
      }
    }

    return { valid: true };
  }

  private fnv1a(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
}
