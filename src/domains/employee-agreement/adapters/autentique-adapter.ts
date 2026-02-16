/**
 * Autentique Adapter — Digital Signature Provider
 *
 * Integra com a API da Autentique para assinatura digital.
 * Requer AUTENTIQUE_API_KEY configurada como secret.
 *
 * Docs: https://docs.autentique.com.br
 */

import type { ISignatureProvider, SignatureRequest, SignatureResponse, SignatureStatusResponse } from '../ports';
import type { SignatureProvider } from '../types';
import { supabase } from '@/integrations/supabase/client';

const EDGE_FUNCTION_NAME = 'agreement-signature';

export const autentiqueAdapter: ISignatureProvider = {
  provider: 'autentique' as SignatureProvider,

  async sendForSignature(request: SignatureRequest): Promise<SignatureResponse> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: {
        action: 'send',
        provider: 'autentique',
        employee_nome: request.employee_nome,
        employee_email: request.employee_email,
        documento_html: request.documento_html,
        callback_url: request.callback_url,
        employee_cpf: request.employee_cpf,
      },
    });

    if (error) {
      return { provider: 'autentique', external_document_id: '', signing_url: '', status: 'error', error_message: error.message };
    }

    return { provider: 'autentique', external_document_id: data.document_id, signing_url: data.signing_url, status: data.status || 'sent' };
  },

  async checkStatus(externalDocumentId: string): Promise<SignatureStatusResponse> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'status', provider: 'autentique', document_id: externalDocumentId },
    });
    if (error) return { external_document_id: externalDocumentId, status: 'pending' };
    return { external_document_id: externalDocumentId, status: data.status, signed_at: data.signed_at, signed_document_url: data.signed_document_url };
  },

  async cancelSignature(externalDocumentId: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'cancel', provider: 'autentique', document_id: externalDocumentId },
    });
    return !error && data?.cancelled === true;
  },

  async downloadSignedDocument(externalDocumentId: string): Promise<Blob | null> {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { action: 'download', provider: 'autentique', document_id: externalDocumentId },
    });
    if (error || !data) return null;
    return data as Blob;
  },
};
