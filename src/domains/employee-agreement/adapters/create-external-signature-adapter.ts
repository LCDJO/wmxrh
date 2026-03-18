import { supabase } from '@/integrations/supabase/client';
import type {
  ISignatureProvider,
  SignatureRequest,
  SignatureResponse,
  SignatureStatusResponse,
} from '../ports';
import type { SignatureProvider } from '../types';

const EDGE_FUNCTION_NAME = 'agreement-signature';

function decodeBase64ToBlob(base64: string, contentType = 'application/pdf'): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
}

export function createExternalSignatureAdapter(provider: SignatureProvider): ISignatureProvider {
  return {
    provider,

    async sendForSignature(request: SignatureRequest): Promise<SignatureResponse> {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'send',
          provider,
          tenant_id: request.tenant_id,
          employee_nome: request.employee_nome,
          employee_email: request.employee_email,
          documento_html: request.documento_html,
          callback_url: request.callback_url,
          employee_cpf: request.employee_cpf,
          metadata: request.metadata,
        },
      });

      if (error || data?.error) {
        return {
          provider,
          external_document_id: '',
          signing_url: '',
          status: 'error',
          error_message: error?.message ?? data?.error ?? 'Erro ao enviar documento para assinatura.',
        };
      }

      return {
        provider,
        external_document_id: data.document_id ?? '',
        signing_url: data.signing_url ?? '',
        status: data.status ?? 'sent',
      };
    },

    async checkStatus(externalDocumentId: string, tenantId?: string): Promise<SignatureStatusResponse> {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'status',
          provider,
          tenant_id: tenantId,
          document_id: externalDocumentId,
        },
      });

      if (error || data?.error) {
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
        rejection_reason: data.rejection_reason,
      };
    },

    async cancelSignature(externalDocumentId: string, tenantId?: string): Promise<boolean> {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'cancel',
          provider,
          tenant_id: tenantId,
          document_id: externalDocumentId,
        },
      });

      return !error && data?.cancelled === true;
    },

    async downloadSignedDocument(externalDocumentId: string, tenantId?: string): Promise<Blob | null> {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'download',
          provider,
          tenant_id: tenantId,
          document_id: externalDocumentId,
        },
      });

      if (error || !data) return null;
      if (data.content_base64) {
        return decodeBase64ToBlob(data.content_base64, data.content_type);
      }

      return null;
    },
  };
}
