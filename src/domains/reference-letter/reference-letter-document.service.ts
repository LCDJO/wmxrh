/**
 * Reference Letter Document Service
 *
 * Generates the final PDF document with:
 *   - Employee data, period, position
 *   - Suggested text from ReputationScoreEngine
 *   - QR Code for public validation
 *   - SHA-256 hash
 *   - Blockchain proof anchoring
 *   - Dual digital signature (manager + HR)
 *
 * Leverages existing infrastructure:
 *   - qrPdfService (QR + PDF generation + SignedDocument registry)
 *   - executeBlockchainRegistration (async hash anchoring)
 *   - generateDocumentHash (SHA-256)
 */

import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateDocumentHash } from '@/domains/employee-agreement/document-hash';
import { qrPdfService } from '@/domains/document-validation/qr-pdf.service';
import { executeBlockchainRegistration } from '@/domains/blockchain-registry';
import type { ReferenceLetter } from './reference-letter.engine';

// ── Types ──

export interface ReferenceLetterDocumentResult {
  success: boolean;
  /** Signed document ID */
  signed_document_id?: string;
  /** SHA-256 hash of the final PDF */
  hash_sha256?: string;
  /** Validation URL with QR code */
  validation_url?: string;
  /** QR code as data URL (for preview) */
  qr_code_data_url?: string;
  /** Blockchain queue status */
  blockchain_status?: 'queued' | 'confirmed' | 'failed';
  /** Blockchain transaction hash (if already confirmed) */
  transaction_hash?: string;
  /** Storage path */
  storage_path?: string;
  /** Error message */
  error?: string;
}

// ── Helpers ──

function buildDualSignatureHtml(letter: ReferenceLetter): string {
  const managerBlock = letter.manager_signed_at
    ? `<div style="text-align:center;width:45%;">
        <div style="border-top:1px solid #333;padding-top:8px;">
          <strong>Gestor Direto</strong><br/>
          <span style="font-size:11px;color:#555;">
            Assinado em ${format(parseISO(letter.manager_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          ${letter.manager_signature_note ? `<br/><span style="font-size:10px;color:#888;">Obs: ${letter.manager_signature_note}</span>` : ''}
        </div>
      </div>`
    : `<div style="text-align:center;width:45%;"><div style="border-top:1px solid #ccc;padding-top:8px;color:#999;">Gestor Direto — Pendente</div></div>`;

  const hrBlock = letter.hr_signed_at
    ? `<div style="text-align:center;width:45%;">
        <div style="border-top:1px solid #333;padding-top:8px;">
          <strong>RH / Admin</strong><br/>
          <span style="font-size:11px;color:#555;">
            Assinado em ${format(parseISO(letter.hr_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          ${letter.hr_signature_note ? `<br/><span style="font-size:10px;color:#888;">Obs: ${letter.hr_signature_note}</span>` : ''}
        </div>
      </div>`
    : `<div style="text-align:center;width:45%;"><div style="border-top:1px solid #ccc;padding-top:8px;color:#999;">RH / Admin — Pendente</div></div>`;

  return `
    <div style="margin-top:60px;display:flex;justify-content:space-between;">
      ${managerBlock}
      ${hrBlock}
    </div>
  `;
}

function buildReputationBadgeHtml(metadata: any): string {
  const rep = metadata?.reputation_score;
  if (!rep) return '';

  const color = rep.score >= 75 ? '#16a34a' : rep.score >= 60 ? '#ca8a04' : '#dc2626';

  return `
    <div style="margin-top:20px;padding:12px;border:1px solid #e5e5e5;border-radius:4px;font-size:10px;color:#666;">
      <strong style="color:#333;">Score Reputacional:</strong>
      <span style="color:${color};font-weight:bold;margin-left:4px;">${rep.score}/100 (${rep.grade})</span>
      ${rep.suggested_text ? `<br/><em style="color:#16a34a;margin-top:4px;display:block;">"${rep.suggested_text}"</em>` : ''}
    </div>
  `;
}

// ── Main Service ──

export const referenceLetterDocumentService = {

  /**
   * Generate the full reference letter document:
   * PDF + QR Code + Hash + Blockchain proof + dual signature.
   *
   * Prerequisites: Letter must be in 'signed' status (both signatures done).
   */
  async generate(
    letter: ReferenceLetter,
    userId: string,
  ): Promise<ReferenceLetterDocumentResult> {
    try {
      // ── Validate: require dual signature ──
      if (letter.status !== 'signed') {
        return {
          success: false,
          error: 'A carta precisa ter ambas as assinaturas (Gestor + RH) antes de gerar o documento.',
        };
      }

      if (!letter.content_html) {
        return { success: false, error: 'Carta sem conteúdo HTML gerado.' };
      }

      // ── Fetch employee & company data ──
      const { data: employee } = await supabase
        .from('employees')
        .select('name, hire_date, position_id, company_id')
        .eq('id', letter.employee_id)
        .eq('tenant_id', letter.tenant_id)
        .maybeSingle();

      const { data: archive } = await supabase
        .from('archived_employee_profiles')
        .select('employee_snapshot, data_desligamento')
        .eq('employee_id', letter.employee_id)
        .eq('tenant_id', letter.tenant_id)
        .maybeSingle();

      const empSnap = archive?.employee_snapshot as any;
      const empName = employee?.name || empSnap?.personalData?.nome_completo || 'Colaborador';

      let companyName = 'Empresa';
      const companyId = employee?.company_id || empSnap?.record?.company_id;
      if (companyId) {
        const { data: co } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
        companyName = co?.name || companyName;
      }

      // ── Build final HTML with dual signatures + reputation badge ──
      const signatureHtml = buildDualSignatureHtml(letter);
      const reputationHtml = buildReputationBadgeHtml(letter.metadata);

      const finalHtml = `
        ${letter.content_html}
        ${signatureHtml}
        ${reputationHtml}
        <div style="margin-top:30px;padding-top:10px;border-top:1px solid #e5e5e5;font-size:9px;color:#999;text-align:center;">
          Documento gerado digitalmente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          — ${companyName}
        </div>
      `;

      // ── Generate PDF with QR Code via existing infrastructure ──
      const result = await qrPdfService.generateAndStore({
        contentHtml: finalHtml,
        tenantId: letter.tenant_id,
        employeeId: letter.employee_id,
        versao: 1,
        companyId: companyId ?? null,
        signerName: empName,
        documentTitle: 'Carta de Referência Profissional',
        ipAssinatura: null,
        metadata: {
          document_type: 'reference_letter',
          letter_id: letter.id,
          manager_signer_id: letter.manager_signer_id,
          hr_signer_id: letter.hr_signer_id,
        },
      } as any);

      if (!result) {
        return { success: false, error: 'Falha ao gerar PDF com QR Code.' };
      }

      // ── Compute final hash ──
      const pdfText = await result.pdfBlob.text();
      const finalHash = await generateDocumentHash(pdfText);

      // ── Blockchain anchoring (async queue) ──
      let blockchainStatus: 'queued' | 'confirmed' | 'failed' = 'queued';
      let transactionHash: string | undefined;

      try {
        const bcResult = await executeBlockchainRegistration({
          tenant_id: letter.tenant_id,
          signed_document_id: result.signedDocument.id,
          document_content: pdfText,
          created_by: userId,
        });

        if (bcResult.success) {
          blockchainStatus = bcResult.status || 'queued';
          transactionHash = bcResult.transaction_hash;
        }
      } catch (bcErr) {
        console.warn('[ReferenceLetterDocument] Blockchain anchoring failed (non-blocking):', bcErr);
        blockchainStatus = 'failed';
      }

      // ── Update letter metadata with document info ──
      await supabase
        .from('reference_letters')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          metadata: {
            ...(letter.metadata || {}),
            document: {
              signed_document_id: result.signedDocument.id,
              hash_sha256: finalHash,
              validation_url: result.validationUrl,
              storage_path: result.storagePath,
              blockchain_status: blockchainStatus,
              transaction_hash: transactionHash || null,
              generated_at: new Date().toISOString(),
              generated_by: userId,
            },
          },
        } as any)
        .eq('id', letter.id);

      return {
        success: true,
        signed_document_id: result.signedDocument.id,
        hash_sha256: finalHash,
        validation_url: result.validationUrl,
        qr_code_data_url: result.qrCodeDataUrl,
        blockchain_status: blockchainStatus,
        transaction_hash: transactionHash,
        storage_path: result.storagePath,
      };
    } catch (err: any) {
      console.error('[ReferenceLetterDocument] generate error:', err);
      return { success: false, error: err.message || 'Erro ao gerar documento.' };
    }
  },

  /**
   * Download the generated PDF from storage.
   */
  async downloadPdf(storagePath: string): Promise<Blob | null> {
    const { data, error } = await supabase.storage
      .from('signed-documents')
      .download(storagePath);

    if (error) {
      console.error('[ReferenceLetterDocument] download error:', error.message);
      return null;
    }
    return data;
  },
};
