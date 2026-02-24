/**
 * PDF Document Generator — Section-based composition
 *
 * Generates A4 PDFs with:
 *   - Header (company name, document title, date)
 *   - Body (template HTML with variables replaced)
 *   - Footer (QR Code + validator code)
 *
 * Uses html2canvas for section capture and jsPDF for page composition.
 * Handles intelligent page breaks per section.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

// ── Constants ──────────────────────────────────────────────
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const SECTION_GAP_MM = 3;
const HEADER_HEIGHT_MM = 22;
const FOOTER_HEIGHT_MM = 28;
const BODY_AREA_MM = A4_HEIGHT_MM - MARGIN_MM * 2 - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - SECTION_GAP_MM * 2;

export interface PdfDocumentOptions {
  companyName: string;
  documentTitle: string;
  contentHtml: string;
  /** Optional date string, defaults to today */
  date?: string;
  /** Base URL for verification (e.g. https://app.com/verificar) */
  verificationBaseUrl?: string;
}

// ── Helpers ────────────────────────────────────────────────

/** Generate a deterministic-ish validator code from content */
function generateValidatorCode(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  const ts = Date.now().toString(36);
  const h = Math.abs(hash).toString(36).toUpperCase();
  return `DOC-${h}-${ts}`.substring(0, 24);
}

/** Create a hidden container, append HTML, return element */
function createOffscreen(html: string, widthPx = 794): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:${widthPx}px;background:#fff;`;
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

/** Capture an HTML element to canvas */
async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
}

/** Convert canvas to image dimensions in mm relative to content width */
function canvasToMM(canvas: HTMLCanvasElement): { widthMM: number; heightMM: number } {
  const scale = 2; // matches html2canvas scale
  const widthPx = canvas.width / scale;
  const heightPx = canvas.height / scale;
  const ratio = CONTENT_WIDTH_MM / widthPx;
  return { widthMM: CONTENT_WIDTH_MM, heightMM: heightPx * ratio };
}

// ── Header HTML ────────────────────────────────────────────
function buildHeaderHtml(companyName: string, title: string, date: string): string {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 16px 24px; border-bottom: 2px solid #1a1a2e;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 16px; font-weight: 700; color: #1a1a2e; letter-spacing: 0.5px;">${companyName}</div>
          <div style="font-size: 11px; color: #666; margin-top: 2px;">Documento Oficial</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #666;">${date}</div>
        </div>
      </div>
      <div style="margin-top: 10px; font-size: 14px; font-weight: 600; color: #333; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
        ${title}
      </div>
    </div>
  `;
}

// ── Footer HTML ────────────────────────────────────────────
function buildFooterHtml(qrDataUrl: string, validatorCode: string, pageNum: number, totalPages: string): string {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 12px 24px; border-top: 1px solid #ddd;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${qrDataUrl}" width="56" height="56" style="border: 1px solid #eee; border-radius: 4px;" />
          <div>
            <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Código Validador</div>
            <div style="font-size: 11px; font-weight: 600; color: #333; font-family: monospace; letter-spacing: 1px;">${validatorCode}</div>
            <div style="font-size: 7px; color: #aaa; margin-top: 2px;">Escaneie o QR Code para verificar autenticidade</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 9px; color: #999;">Página ${pageNum} de ${totalPages}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Body HTML ──────────────────────────────────────────────
function buildBodyHtml(contentHtml: string): string {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; padding: 20px 24px; font-size: 13px; line-height: 1.7; color: #222;">
      ${contentHtml}
    </div>
  `;
}

// ── Main Generator ─────────────────────────────────────────
export async function generateDocumentPdf(options: PdfDocumentOptions): Promise<void> {
  const {
    companyName,
    documentTitle,
    contentHtml,
    date = new Date().toLocaleDateString('pt-BR'),
    verificationBaseUrl = window.location.origin + '/verificar',
  } = options;

  const validatorCode = generateValidatorCode(contentHtml + companyName + documentTitle);
  const verifyUrl = `${verificationBaseUrl}/${validatorCode}`;

  // Generate QR code data URL
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  // ── Step 1: Capture body to determine total pages ──
  const bodyContainer = createOffscreen(buildBodyHtml(contentHtml));
  const bodyCanvas = await captureElement(bodyContainer);
  const { heightMM: totalBodyMM } = canvasToMM(bodyCanvas);
  document.body.removeChild(bodyContainer);

  const totalPages = Math.max(1, Math.ceil(totalBodyMM / BODY_AREA_MM));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Step 2: Render pages ──
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // -- Header --
    const headerEl = createOffscreen(buildHeaderHtml(companyName, documentTitle, date));
    const headerCanvas = await captureElement(headerEl);
    const headerDims = canvasToMM(headerCanvas);
    pdf.addImage(
      headerCanvas.toDataURL('image/png'),
      'PNG',
      MARGIN_MM,
      MARGIN_MM,
      headerDims.widthMM,
      headerDims.heightMM
    );
    document.body.removeChild(headerEl);

    // -- Footer --
    const footerEl = createOffscreen(buildFooterHtml(qrDataUrl, validatorCode, page + 1, String(totalPages)));
    const footerCanvas = await captureElement(footerEl);
    const footerDims = canvasToMM(footerCanvas);
    const footerY = A4_HEIGHT_MM - MARGIN_MM - footerDims.heightMM;
    pdf.addImage(
      footerCanvas.toDataURL('image/png'),
      'PNG',
      MARGIN_MM,
      footerY,
      footerDims.widthMM,
      footerDims.heightMM
    );
    document.body.removeChild(footerEl);

    // -- Body slice --
    // We need to clip the body canvas for this page
    const bodyStartMM = page * BODY_AREA_MM;
    const bodySliceMM = Math.min(BODY_AREA_MM, totalBodyMM - bodyStartMM);
    const bodyTopY = MARGIN_MM + headerDims.heightMM + SECTION_GAP_MM;

    if (bodySliceMM > 0) {
      // Calculate pixel coordinates for slicing
      const scale = 2;
      const pxPerMM = (bodyCanvas.width / scale) / CONTENT_WIDTH_MM;
      const sliceStartPx = Math.round(bodyStartMM * pxPerMM * scale);
      const sliceHeightPx = Math.round(bodySliceMM * pxPerMM * scale);

      // Create a sliced canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = bodyCanvas.width;
      sliceCanvas.height = Math.min(sliceHeightPx, bodyCanvas.height - sliceStartPx);
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          bodyCanvas,
          0, sliceStartPx, bodyCanvas.width, sliceCanvas.height,
          0, 0, sliceCanvas.width, sliceCanvas.height
        );
      }

      pdf.addImage(
        sliceCanvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        bodyTopY,
        CONTENT_WIDTH_MM,
        bodySliceMM
      );
    }
  }

  // ── Step 3: Save ──
  const slug = documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  pdf.save(`${slug}.pdf`);
}
