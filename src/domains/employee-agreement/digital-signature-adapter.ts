/**
 * DigitalSignatureProviderAdapter
 *
 * Facade over the provider registry (Ports & Adapters pattern).
 * Routes signature operations to the correct provider adapter
 * (OpenSign, DocuSign, ClickSign, Simulation, etc.)
 *
 * Components should call this adapter instead of accessing
 * individual provider adapters directly.
 */

import {
  getSignatureProvider,
  registerSignatureProvider,
  listRegisteredProviders,
  type SignatureRequest,
  type SignatureResponse,
  type SignatureStatusResponse,
} from './ports';
import type { SignatureProvider } from './types';

export const digitalSignatureAdapter = {

  /**
   * Send a document for digital signature via the specified provider.
   */
  async send(
    providerName: SignatureProvider,
    request: SignatureRequest,
  ): Promise<SignatureResponse> {
    const provider = getSignatureProvider(providerName);
    if (!provider) {
      // Fallback: return pending status if provider not registered
      console.warn(`[DigitalSignature] Provider "${providerName}" not registered. Returning pending.`);
      return {
        provider: providerName,
        external_document_id: '',
        signing_url: '',
        status: 'created',
      };
    }
    return provider.sendForSignature(request);
  },

  /**
   * Check signature status at the provider.
   */
  async checkStatus(
    providerName: SignatureProvider,
    externalDocumentId: string,
  ): Promise<SignatureStatusResponse> {
    const provider = getSignatureProvider(providerName);
    if (!provider) {
      return { external_document_id: externalDocumentId, status: 'pending' };
    }
    return provider.checkStatus(externalDocumentId);
  },

  /**
   * Cancel a pending signature at the provider.
   */
  async cancel(
    providerName: SignatureProvider,
    externalDocumentId: string,
  ): Promise<boolean> {
    const provider = getSignatureProvider(providerName);
    if (!provider) return false;
    return provider.cancelSignature(externalDocumentId);
  },

  /**
   * Download the signed document from the provider.
   */
  async download(
    providerName: SignatureProvider,
    externalDocumentId: string,
  ): Promise<Blob | null> {
    const provider = getSignatureProvider(providerName);
    if (!provider) return null;
    return provider.downloadSignedDocument(externalDocumentId);
  },

  /** Re-export registry helpers */
  register: registerSignatureProvider,
  listProviders: listRegisteredProviders,
};
