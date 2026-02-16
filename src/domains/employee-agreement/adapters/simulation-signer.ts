/**
 * Simulation Signature Adapter
 *
 * For development/testing — simulates a digital signature provider.
 */

import type { ISignatureProvider, SignatureRequest, SignatureResponse, SignatureStatusResponse } from '../ports';
import type { SignatureProvider } from '../types';

const simulatedDocs = new Map<string, {
  request: SignatureRequest;
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  signed_at?: string;
  created_at: string;
}>();

export const simulationSignerAdapter: ISignatureProvider = {
  provider: 'simulation' as SignatureProvider,

  async sendForSignature(request: SignatureRequest): Promise<SignatureResponse> {
    const id = `sim_${crypto.randomUUID().slice(0, 8)}`;
    simulatedDocs.set(id, { request, status: 'pending', created_at: new Date().toISOString() });

    return {
      provider: 'simulation',
      external_document_id: id,
      signing_url: `https://simulation.local/sign/${id}`,
      status: 'sent',
    };
  },

  async checkStatus(externalDocumentId: string): Promise<SignatureStatusResponse> {
    const doc = simulatedDocs.get(externalDocumentId);
    if (!doc) return { external_document_id: externalDocumentId, status: 'expired' };

    // Auto-sign after 5 seconds for testing
    const elapsed = Date.now() - new Date(doc.created_at).getTime();
    if (elapsed > 5000 && doc.status === 'pending') {
      doc.status = 'signed';
      doc.signed_at = new Date().toISOString();
    }

    return {
      external_document_id: externalDocumentId,
      status: doc.status,
      signed_at: doc.signed_at,
      signed_document_url: doc.status === 'signed' ? `https://simulation.local/docs/${externalDocumentId}.pdf` : undefined,
      signed_document_hash: doc.status === 'signed' ? `sha256:sim_${externalDocumentId}` : undefined,
    };
  },

  async cancelSignature(externalDocumentId: string): Promise<boolean> {
    const doc = simulatedDocs.get(externalDocumentId);
    if (doc && doc.status === 'pending') { doc.status = 'expired'; return true; }
    return false;
  },

  async downloadSignedDocument(): Promise<Blob | null> {
    return new Blob(['%PDF-1.4 Simulated Signed Document'], { type: 'application/pdf' });
  },
};
