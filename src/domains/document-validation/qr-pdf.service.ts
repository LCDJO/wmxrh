/**
 * QR Code PDF Generation Service
 *
 * After a document is signed:
 *   1. Generate public validation URL: /public/validate/{validation_token}
 *   2. Generate QR Code as data URL
 *   3. Insert QR Code into the PDF
 *   4. Store final version in Cloud Storage
 *   5. Register in SignedDocumentRegistry
 *
 * Uses jsPDF + html2canvas for client-side PDF generation.
 * Uses qrcode.react pattern (but raw canvas API for service context).
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import { signedDocumentRegistry } from './signed-document.service';
import type { SignedDocument } from './signed-document.types';

const BUCKET = 'signed-documents';

// ── QR Code generation using Canvas API ──

async function generateQRCodeDataUrl(url: string, size = 200): Promise<string> {
  // Dynamic import to avoid SSR issues
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ── Public API ──

export interface QRPdfGenerationParams {
  /** The HTML content of the agreement to render as PDF */
  contentHtml: string;
  /** Tenant ID */
  tenantId: string;
  /** Employee ID */
  employeeId: string;
  /** Agreement template ID */
  agreementTemplateId?: string | null;
  /** Version number */
  versao: number;
  /** IP address of the signer */
  ipAssinatura?: string | null;
  /** External provider signature ID */
  providerSignatureId?: string | null;
  /** Company ID */
  companyId?: string | null;
  /** Document title for the footer */
  documentTitle?: string;
  /** Signer name for the footer */
  signerName?: string;
  /** Signature date override */
  dataAssinatura?: string;
}

export interface QRPdfGenerationResult {
  signedDocument: SignedDocument;
  pdfBlob: Blob;
  validationUrl: string;
  qrCodeDataUrl: string;
  storagePath: string;
}

export const qrPdfService = {

  /**
   * Build the public validation URL.
   */
  getValidationUrl(validationToken: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/public/validate/${validationToken}`;
  },

  /**
   * Generate a QR code as a data URL for a validation token.
   */
  async generateQRCode(validationToken: string, size = 200): Promise<string> {
    const url = this.getValidationUrl(validationToken);
    return generateQRCodeDataUrl(url, size);
  },

  /**
   * Full pipeline: render HTML → add QR code → generate PDF → store → register.
   */
  async generateAndStore(params: QRPdfGenerationParams): Promise<QRPdfGenerationResult | null> {
    try {
      // 1. Create a temporary container for rendering
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:40px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#000;';

      // Insert agreement content
      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = params.contentHtml;
      container.appendChild(contentDiv);

      // Placeholder for QR — we'll add it after we get the token
      const qrSection = document.createElement('div');
      qrSection.style.cssText = 'margin-top:30px;padding-top:20px;border-top:1px solid #ccc;display:flex;align-items:center;gap:16px;';
      container.appendChild(qrSection);

      document.body.appendChild(container);

      // 2. First pass: register the document to get validation_token
      //    We need a temporary hash — will update after final PDF
      const tempHash = await generateDocumentHash(params.contentHtml);

      const signedDoc = await signedDocumentRegistry.register({
        tenant_id: params.tenantId,
        employee_id: params.employeeId,
        agreement_template_id: params.agreementTemplateId ?? null,
        versao: params.versao,
        hash_sha256: tempHash, // Temporary — immutability is on the row after insert
        documento_url: 'pending', // Will be set via new row
        data_assinatura: params.dataAssinatura ?? new Date().toISOString(),
        ip_assinatura: params.ipAssinatura ?? null,
        provider_signature_id: params.providerSignatureId ?? null,
        company_id: params.companyId ?? null,
      });

      if (!signedDoc) {
        document.body.removeChild(container);
        return null;
      }

      // 3. Generate QR code with the real validation token
      const validationUrl = this.getValidationUrl(signedDoc.validation_token);
      const qrDataUrl = await generateQRCodeDataUrl(validationUrl, 120);

      // 4. Add QR section to the document
      const qrImg = document.createElement('img');
      qrImg.src = qrDataUrl;
      qrImg.style.cssText = 'width:100px;height:100px;';

      const qrInfo = document.createElement('div');
      qrInfo.style.cssText = 'font-size:9px;color:#666;';
      qrInfo.innerHTML = `
        <strong>Documento assinado digitalmente</strong><br/>
        Token: ${signedDoc.validation_token}<br/>
        Data: ${new Date(signedDoc.data_assinatura).toLocaleString('pt-BR')}<br/>
        ${params.signerName ? `Assinante: ${params.signerName}<br/>` : ''}
        Validação: ${validationUrl}<br/>
        Hash SHA-256: ${tempHash.substring(0, 16)}...
      `;

      qrSection.appendChild(qrImg);
      qrSection.appendChild(qrInfo);

      // 5. Render to canvas → PDF
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(container);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output('blob');

      // 6. Compute final hash over the actual PDF
      const pdfText = await pdfBlob.text();
      const finalHash = await generateDocumentHash(pdfText);

      // 7. Upload to Cloud Storage
      const filename = `signed_v${params.versao}_${signedDoc.id}.pdf`;
      const storagePath = `${params.tenantId}/${signedDoc.id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('[QRPdfService] Upload failed:', uploadError.message);
        return null;
      }

      // 8. Create the final immutable record with correct hash + URL
      const finalDoc = await signedDocumentRegistry.register({
        tenant_id: params.tenantId,
        employee_id: params.employeeId,
        agreement_template_id: params.agreementTemplateId ?? null,
        versao: params.versao,
        hash_sha256: finalHash,
        documento_url: storagePath,
        data_assinatura: params.dataAssinatura ?? new Date().toISOString(),
        ip_assinatura: params.ipAssinatura ?? null,
        provider_signature_id: params.providerSignatureId ?? null,
        company_id: params.companyId ?? null,
        metadata: {
          qr_validation_url: validationUrl,
          original_token_id: signedDoc.id,
          content_hash: tempHash,
        },
      });

      // Deactivate the temporary record
      await signedDocumentRegistry.deactivate(signedDoc.id, params.tenantId);

      return {
        signedDocument: finalDoc ?? signedDoc,
        pdfBlob,
        validationUrl,
        qrCodeDataUrl: qrDataUrl,
        storagePath,
      };
    } catch (err) {
      console.error('[QRPdfService] generateAndStore error:', err);
      return null;
    }
  },

  /**
   * Generate QR code only (for display/preview, without full PDF pipeline).
   */
  async generateQRCodeForDocument(validationToken: string): Promise<string> {
    return this.generateQRCode(validationToken, 200);
  },
};
