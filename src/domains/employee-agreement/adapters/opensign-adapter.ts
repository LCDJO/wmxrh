/**
 * OpenSign Adapter — Digital Signature Provider
 *
 * Integrates with OpenSign API for document signing.
 * Requires OPENSIGN_API_KEY secret configured in edge functions.
 *
 * This adapter is designed to be called from an edge function
 * that proxies requests to the OpenSign API.
 */

import type { ISignatureProvider, SignatureRequest, SignatureResponse, SignatureStatusResponse } from '../ports';
import type { SignatureProvider } from '../types';
import { supabase } from '@/integrations/supabase/client';

const EDGE_FUNCTION_NAME = 'agreement-signature';

export const openSignAdapter: ISignatureProvider = {
  provider: 'opensign' as SignatureProvider,

  async sendForSignature(request: SignatureRequest): Promise<SignatureResponse> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'send',
        provider: 'opensign',
        ...request,
      },
    });

    if (error) {
      return {
        provider: 'opensign',
        external_document_id: '',
        signing_url: '',
        status: 'error',
        error_message: error.message,
      };
    }

    return {
      provider: 'opensign',
      external_document_id: data.document_id,
      signing_url: data.signing_url,
      status: data.status || 'sent',
    };
  },

  async checkStatus(externalDocumentId: string): Promise<SignatureStatusResponse> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'status',
        provider: 'opensign',
        document_id: externalDocumentId,
      },
    });

    if (error) {
      return { external_document_id: externalDocumentId, status: 'pending' };
    }

    return {
      external_document_id: externalDocumentId,
      status: data.status,
      signed_at: data.signed_at,
      signed_document_url: data.signed_document_url,
      signed_document_hash: data.signed_document_hash,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      refusal_reason: data.refusal_reason,
    };
  },

  async cancelSignature(externalDocumentId: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'cancel',
        provider: 'opensign',
        document_id: externalDocumentId,
      },
    });

    return !error && data?.cancelled === true;
  },

  async downloadSignedDocument(externalDocumentId: string): Promise<Blob | null> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'download',
        provider: 'opensign',
        document_id: externalDocumentId,
      },
    });

    if (error || !data) return null;
    return data as Blob;
  },
};
