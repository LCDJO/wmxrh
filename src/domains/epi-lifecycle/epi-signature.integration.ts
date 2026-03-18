/**
 * EPI Signature Integration Service
 *
 * Integrates EPI delivery with:
 *   - Employee Agreement Engine (term generation)
 *   - DigitalSignatureProvider (digital signing)
 *   - DocumentVault (signed PDF storage)
 *
 * Flow:
 *   1. Generate Termo de Entrega HTML
 *   2. Send to DigitalSignatureProvider via adapter
 *   3. Poll/webhook updates assinatura_status
 *   4. On signed: store PDF in DocumentVault, register hash
 *   5. Emit EPIReceiptSigned event
 */

import { supabase } from '@/integrations/supabase/client';
import { digitalSignatureAdapter } from '@/domains/employee-agreement/digital-signature-adapter';
import { documentVault } from '@/domains/employee-agreement/document-vault';
import { resolveTenantSignatureProvider } from '@/domains/employee-agreement/tenant-signature-provider.service';
import { buildAgreementWebhookUrl } from '@/domains/employee-agreement/signature-webhook-url';
import type { SignatureProvider } from '@/domains/employee-agreement/types';

const DEFAULT_PROVIDER: SignatureProvider = 'simulation';

// ═══════════════════════════════════════════════════════
// GENERATE TERMO HTML
// ═══════════════════════════════════════════════════════

interface TermoData {
  employeeName: string;
  epiNome: string;
  caNumero: string;
  dataEntrega: string;
  quantidade: number;
  lote?: string;
  motivo: string;
  tenantName?: string;
}

function generateTermoHtml(data: TermoData): string {
  const motivoLabels: Record<string, string> = {
    entrega_inicial: 'Entrega Inicial',
    substituicao_desgaste: 'Substituição por Desgaste',
    substituicao_dano: 'Substituição por Dano',
    substituicao_vencimento: 'Substituição por Vencimento',
    novo_risco: 'Novo Risco Identificado',
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px;">
      <h1 style="text-align: center; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 12px;">
        TERMO DE ENTREGA DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL — EPI
      </h1>
      
      <p style="margin-top: 24px; font-size: 14px; line-height: 1.6;">
        Declaro, para os devidos fins e efeitos legais, que recebi do empregador o Equipamento de Proteção 
        Individual (EPI) abaixo descrito, em perfeitas condições de uso, conforme determina a 
        <strong>Norma Regulamentadora NR-6</strong> do Ministério do Trabalho e Emprego.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; width: 35%; background: #f5f5f5;">Colaborador</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.employeeName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">EPI</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.epiNome}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">Certificado de Aprovação (CA)</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.caNumero || '—'}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">Data de Entrega</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.dataEntrega}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">Quantidade</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.quantidade}</td>
        </tr>
        ${data.lote ? `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">Lote</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${data.lote}</td>
        </tr>` : ''}
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; background: #f5f5f5;">Motivo</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${motivoLabels[data.motivo] ?? data.motivo}</td>
        </tr>
      </table>

      <h3 style="font-size: 14px; margin-top: 24px;">Compromissos do Colaborador:</h3>
      <ol style="font-size: 13px; line-height: 1.8;">
        <li>Utilizar o EPI apenas para a finalidade a que se destina;</li>
        <li>Responsabilizar-se pela guarda e conservação;</li>
        <li>Comunicar ao empregador qualquer alteração que o torne impróprio para uso;</li>
        <li>Cumprir as determinações do empregador sobre o uso adequado;</li>
        <li>Devolver o EPI quando não mais necessário ou ao término do contrato de trabalho.</li>
      </ol>

      <p style="font-size: 13px; margin-top: 24px; line-height: 1.6;">
        Declaro ainda ter recebido treinamento sobre o uso correto, guarda e conservação do EPI acima 
        descrito, estando ciente das penalidades cabíveis em caso de descumprimento das normas de segurança.
      </p>

      <div style="margin-top: 48px; text-align: center; font-size: 13px;">
        <p>Data: ${data.dataEntrega}</p>
        <div style="margin-top: 40px; border-top: 1px solid #333; width: 300px; margin-left: auto; margin-right: auto; padding-top: 8px;">
          <strong>${data.employeeName}</strong><br/>
          Assinatura do Colaborador
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// SEND FOR SIGNATURE
// ═══════════════════════════════════════════════════════

export interface SendForSignatureInput {
  deliveryId: string;
  tenantId: string;
  employeeName: string;
  employeeEmail: string;
  employeeCpf?: string;
  epiNome: string;
  caNumero: string;
  dataEntrega: string;
  quantidade: number;
  lote?: string;
  motivo: string;
  provider?: SignatureProvider;
}

export async function sendEpiDeliveryForSignature(input: SendForSignatureInput): Promise<{
  success: boolean;
  signingUrl?: string;
  error?: string;
}> {
  const provider = await resolveTenantSignatureProvider(input.tenantId, input.provider ?? DEFAULT_PROVIDER);

  // 1. Generate the termo HTML
  const termoHtml = generateTermoHtml({
    employeeName: input.employeeName,
    epiNome: input.epiNome,
    caNumero: input.caNumero,
    dataEntrega: input.dataEntrega,
    quantidade: input.quantidade,
    lote: input.lote,
    motivo: input.motivo,
  });

  // 2. Send to Digital Signature Provider
  const callbackUrl = `${window.location.origin}/api/epi-signature-webhook`;
  const signResult = await digitalSignatureAdapter.send(provider, {
    tenant_id: input.tenantId,
    employee_nome: input.employeeName,
    employee_email: input.employeeEmail,
    documento_html: termoHtml,
    callback_url: callbackUrl,
    employee_cpf: input.employeeCpf,
    metadata: { delivery_id: input.deliveryId, type: 'epi_delivery_term' },
  });

  if (signResult.status === 'error') {
    return { success: false, error: signResult.error_message ?? 'Erro ao enviar para assinatura' };
  }

  // 3. Update delivery with signature tracking info
  await supabase
    .from('epi_deliveries' as any)
    .update({
      assinatura_status: 'sent',
      external_document_id: signResult.external_document_id || null,
      signature_provider: provider,
    } as any)
    .eq('id', input.deliveryId);

  return {
    success: true,
    signingUrl: signResult.signing_url || undefined,
  };
}

// ═══════════════════════════════════════════════════════
// PROCESS SIGNED DELIVERY (post-signature)
// ═══════════════════════════════════════════════════════

export async function processSignedEpiDelivery(deliveryId: string): Promise<boolean> {
  // 1. Fetch delivery
  const { data: delivery } = await supabase
    .from('epi_deliveries' as any)
    .select('*')
    .eq('id', deliveryId)
    .single();

  if (!delivery) return false;
  const d = delivery as any;

  if (!d.external_document_id || !d.signature_provider) return false;

  // 2. Check status at provider
  const statusResult = await digitalSignatureAdapter.checkStatus(
    d.signature_provider as SignatureProvider,
    d.external_document_id,
    d.tenant_id,
  );

  if (statusResult.status !== 'signed') return false;

  // 3. Store signed PDF in DocumentVault
  const storagePath = await documentVault.storeSignedDocument(
    d.tenant_id,
    deliveryId,
    d.external_document_id,
    d.signature_provider as SignatureProvider,
    d.tenant_id,
  );

  // 4. Generate hash of the signed document content
  const hashDocumento = statusResult.signed_document_hash ?? await generateDocumentHash(deliveryId, d);

  // 5. Update delivery record
  await supabase
    .from('epi_deliveries' as any)
    .update({
      assinatura_status: 'signed',
      storage_path: storagePath,
      hash_documento: hashDocumento,
      documento_assinado_url: null, // Never store signed URLs in DB
    } as any)
    .eq('id', deliveryId);

  // 6. Also create an epi_signatures record for legal audit
  await supabase
    .from('epi_signatures' as any)
    .insert({
      tenant_id: d.tenant_id,
      delivery_id: deliveryId,
      employee_id: d.employee_id,
      tipo_assinatura: 'digital',
      assinatura_hash: hashDocumento,
      assinatura_data: {
        provider: d.signature_provider,
        external_id: d.external_document_id,
        signed_at: statusResult.signed_at,
        ip_address: statusResult.ip_address,
      },
      ip_address: statusResult.ip_address ?? null,
      user_agent: statusResult.user_agent ?? null,
      termo_aceite: 'Termo de Entrega de EPI assinado digitalmente',
      documento_url: storagePath,
    });

  return true;
}

// ═══════════════════════════════════════════════════════
// MANUAL / QUICK SIGNATURE (for in-person signing)
// ═══════════════════════════════════════════════════════

export async function quickSignEpiDelivery(deliveryId: string, tenantId: string, employeeId: string): Promise<boolean> {
  // Generate hash from delivery data
  const content = JSON.stringify({
    delivery_id: deliveryId,
    employee_id: employeeId,
    type: 'epi_delivery_quick_sign',
    timestamp: new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Update delivery
  const { error: updateErr } = await supabase
    .from('epi_deliveries' as any)
    .update({
      assinatura_status: 'signed',
      hash_documento: hashHex,
      signature_provider: 'manual',
    } as any)
    .eq('id', deliveryId);

  if (updateErr) return false;

  // Create signature record
  const { error: sigErr } = await supabase
    .from('epi_signatures' as any)
    .insert({
      tenant_id: tenantId,
      delivery_id: deliveryId,
      employee_id: employeeId,
      tipo_assinatura: 'digital',
      assinatura_hash: hashHex,
      ip_address: null,
      user_agent: navigator.userAgent,
      termo_aceite: 'Termo de Entrega de EPI — assinatura presencial confirmada digitalmente',
    });

  return !sigErr;
}

// ═══════════════════════════════════════════════════════
// GET SIGNED DOCUMENT URL
// ═══════════════════════════════════════════════════════

export async function getSignedDocumentUrl(deliveryId: string): Promise<string | null> {
  const { data } = await supabase
    .from('epi_deliveries' as any)
    .select('storage_path')
    .eq('id', deliveryId)
    .single();

  const storagePath = (data as any)?.storage_path;
  if (!storagePath) return null;

  return documentVault.getViewUrl(storagePath);
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

async function generateDocumentHash(deliveryId: string, delivery: { employee_id: string; epi_catalog_id: string; data_entrega: string }): Promise<string> {
  const content = JSON.stringify({
    delivery_id: deliveryId,
    employee_id: delivery.employee_id,
    epi_catalog_id: delivery.epi_catalog_id,
    data_entrega: delivery.data_entrega,
    signed_at: new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
