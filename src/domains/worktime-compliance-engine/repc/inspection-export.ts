/**
 * InspectionExportService — Disponibilização para fiscalização do MTE.
 * Portaria 671/2021 Art. 83 — Obrigação de entrega imediata.
 */

import type {
  InspectionExportRequest, InspectionExportFormat, InspectionExportFile,
} from './types';
import { AFDGenerator } from './afd-generator';
import { AEJGenerator } from './aej-generator';
import type { WorkTimeLedgerEntry, LedgerAdjustment } from '../types';

export class InspectionExportService {
  private requests: InspectionExportRequest[] = [];
  private afdGen = new AFDGenerator();
  private aejGen = new AEJGenerator();

  async createRequest(
    tenantId: string,
    request: Omit<InspectionExportRequest, 'id' | 'status' | 'files'>,
  ): Promise<InspectionExportRequest> {
    const full: InspectionExportRequest = {
      ...request,
      id: crypto.randomUUID(),
      status: 'requested',
      files: [],
    };
    this.requests.push(full);
    return full;
  }

  /**
   * Generate all requested export files.
   * In production this would read from the ImmutableTimeLedger via Supabase.
   */
  async generateFiles(
    requestId: string,
    entries: WorkTimeLedgerEntry[] = [],
    adjustments: LedgerAdjustment[] = [],
    employerCnpj = '',
    employerName = '',
  ): Promise<InspectionExportRequest> {
    const req = this.requests.find(r => r.id === requestId);
    if (!req) throw new Error(`Inspection request ${requestId} not found`);

    req.status = 'generating';
    const files: InspectionExportFile[] = [];

    for (const format of req.formats) {
      const file = await this.generateFile(format, req, entries, adjustments, employerCnpj, employerName);
      if (file) files.push(file);
    }

    req.files = files;
    req.status = 'ready';
    return req;
  }

  markDelivered(requestId: string, deliveredTo: string): void {
    const req = this.requests.find(r => r.id === requestId);
    if (!req) return;
    req.status = 'delivered';
    req.delivered_at = new Date().toISOString();
    req.delivered_to = deliveredTo;
  }

  getRequests(tenantId: string): InspectionExportRequest[] {
    return this.requests.filter(r => r.tenant_id === tenantId);
  }

  private async generateFile(
    format: InspectionExportFormat,
    request: InspectionExportRequest,
    entries: WorkTimeLedgerEntry[],
    adjustments: LedgerAdjustment[],
    cnpj: string,
    name: string,
  ): Promise<InspectionExportFile | null> {
    const now = new Date().toISOString();

    if (format === 'AFD') {
      const afd = this.afdGen.generateFromEntries(
        {
          cnpj_cpf: cnpj,
          cei_caepf: '',
          razao_social: name,
          numero_registro_rep: '',
          data_inicio: request.period_start,
          data_fim: request.period_end,
        },
        entries,
        adjustments,
      );
      const text = this.afdGen.toText(afd);
      return {
        format: 'AFD',
        file_url: `blob:afd_${request.id}`,
        file_hash: afd.content_hash,
        file_size_bytes: new TextEncoder().encode(text).length,
        record_count: afd.details.length,
        generated_at: now,
      };
    }

    if (format === 'AEJ') {
      const aej = this.aejGen.generate(cnpj, name, request.period_start, request.period_end, entries, request.requested_by);
      const text = this.aejGen.toText(aej);
      return {
        format: 'AEJ',
        file_url: `blob:aej_${request.id}`,
        file_hash: aej.content_hash,
        file_size_bytes: new TextEncoder().encode(text).length,
        record_count: aej.jornadas.length,
        generated_at: now,
      };
    }

    // Other formats can be added
    return null;
  }
}
