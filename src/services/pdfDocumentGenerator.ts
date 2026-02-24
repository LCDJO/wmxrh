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

// Default values (overridable by layout config)
const DEFAULT_MARGIN_MM = 15;
const DEFAULT_SECTION_GAP_MM = 3;
const DEFAULT_HEADER_HEIGHT_MM = 22;
const DEFAULT_FOOTER_HEIGHT_MM = 28;

export interface PdfLayoutOverrides {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  sectionGap?: number;
  headerFontFamily?: string;
  bodyFontFamily?: string;
  footerFontFamily?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
  footerFontSize?: number;
  bodyLineHeight?: number;
  primaryColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
  headerBorderColor?: string;
  showLogo?: boolean;
  logoUrl?: string | null;
  companyNameOverride?: string | null;
  headerSubtitle?: string | null;
  showDate?: boolean;
  showQrCode?: boolean;
  showValidatorCode?: boolean;
  showPageNumbers?: boolean;
  qrCodeSize?: number;
  footerText?: string | null;
  watermarkEnabled?: boolean;
  watermarkType?: string;
  watermarkText?: string | null;
  watermarkImageUrl?: string | null;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  watermarkFontSize?: number;
  watermarkColor?: string;
  watermarkPosition?: string;
}

export interface PdfDocumentOptions {
  companyName: string;
  documentTitle: string;
  contentHtml: string;
  date?: string;
  verificationBaseUrl?: string;
  layout?: PdfLayoutOverrides;
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
function canvasToMM(canvas: HTMLCanvasElement, contentWidthMM: number): { widthMM: number; heightMM: number } {
  const scale = 2;
  const widthPx = canvas.width / scale;
  const heightPx = canvas.height / scale;
  const ratio = contentWidthMM / widthPx;
  return { widthMM: contentWidthMM, heightMM: heightPx * ratio };
}

// ── Header HTML ────────────────────────────────────────────
function buildHeaderHtml(companyName: string, title: string, date: string, L: PdfLayoutOverrides): string {
  const font = L.headerFontFamily || 'Helvetica Neue, Arial, sans-serif';
  const size = L.headerFontSize || 16;
  const border = L.headerBorderColor || '#1a1a2e';
  const primary = L.primaryColor || '#1a1a2e';
  const secondary = L.secondaryTextColor || '#666';
  const subtitle = L.headerSubtitle ?? 'Documento Oficial';
  const showDate = L.showDate ?? true;
  const showLogo = L.showLogo ?? true;
  const logoUrl = L.logoUrl;

  const logoHtml = showLogo && logoUrl
    ? `<img src="${logoUrl}" style="height:32px;width:auto;margin-right:8px;" />`
    : '';

  return `
    <div style="font-family: '${font}'; padding: 16px 24px; border-bottom: 2px solid ${border};">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display:flex;align-items:center;">
          ${logoHtml}
          <div>
            <div style="font-size: ${size}px; font-weight: 700; color: ${primary}; letter-spacing: 0.5px;">${companyName}</div>
            <div style="font-size: 11px; color: ${secondary}; margin-top: 2px;">${subtitle}</div>
          </div>
        </div>
        ${showDate ? `<div style="text-align: right;"><div style="font-size: 10px; color: ${secondary};">${date}</div></div>` : ''}
      </div>
      <div style="margin-top: 10px; font-size: 14px; font-weight: 600; color: #333; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
        ${title}
      </div>
    </div>
  `;
}

function buildFooterHtml(qrDataUrl: string, validatorCode: string, pageNum: number, totalPages: string, L: PdfLayoutOverrides): string {
  const showQr = L.showQrCode ?? true;
  const showValidator = L.showValidatorCode ?? true;
  const showPages = L.showPageNumbers ?? true;
  const qrSize = L.qrCodeSize || 56;
  const text = L.textColor || '#333';
  const footerText = L.footerText;

  return `
    <div style="font-family: '${L.footerFontFamily || 'Helvetica Neue, Arial, sans-serif'}'; padding: 12px 24px; border-top: 1px solid #ddd;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${showQr ? `<img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="border: 1px solid #eee; border-radius: 4px;" />` : ''}
          ${showValidator ? `<div>
            <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Código Validador</div>
            <div style="font-size: 11px; font-weight: 600; color: ${text}; font-family: monospace; letter-spacing: 1px;">${validatorCode}</div>
            ${footerText ? `<div style="font-size: 7px; color: #aaa; margin-top: 2px;">${footerText}</div>` : '<div style="font-size: 7px; color: #aaa; margin-top: 2px;">Escaneie o QR Code para verificar autenticidade</div>'}
          </div>` : ''}
        </div>
        ${showPages ? `<div style="text-align: right;"><div style="font-size: 9px; color: #999;">Página ${pageNum} de ${totalPages}</div></div>` : ''}
      </div>
    </div>
  `;
}

function buildBodyHtml(contentHtml: string, L: PdfLayoutOverrides): string {
  return `
    <div style="font-family: ${L.bodyFontFamily || "Georgia, 'Times New Roman', serif"}; padding: 20px 24px; font-size: ${L.bodyFontSize || 13}px; line-height: ${L.bodyLineHeight || 1.7}; color: ${L.textColor || '#222'};">
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
    layout: L = {},
  } = options;

  // Derive layout-aware constants
  const MARGIN_TOP = L.marginTop ?? DEFAULT_MARGIN_MM;
  const MARGIN_BOTTOM = L.marginBottom ?? DEFAULT_MARGIN_MM;
  const MARGIN_LEFT = L.marginLeft ?? DEFAULT_MARGIN_MM;
  const MARGIN_RIGHT = L.marginRight ?? DEFAULT_MARGIN_MM;
  const SECTION_GAP = L.sectionGap ?? DEFAULT_SECTION_GAP_MM;
  const CONTENT_WIDTH = A4_WIDTH_MM - MARGIN_LEFT - MARGIN_RIGHT;
  const BODY_AREA = A4_HEIGHT_MM - MARGIN_TOP - MARGIN_BOTTOM - DEFAULT_HEADER_HEIGHT_MM - DEFAULT_FOOTER_HEIGHT_MM - SECTION_GAP * 2;

  const displayName = L.companyNameOverride || companyName;
  const validatorCode = generateValidatorCode(contentHtml + displayName + documentTitle);
  const verifyUrl = `${verificationBaseUrl}/${validatorCode}`;

  const primaryColor = L.primaryColor || '#1a1a2e';
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: primaryColor, light: '#ffffff' },
  });

  // ── Step 1: Capture body to determine total pages ──
  const bodyContainer = createOffscreen(buildBodyHtml(contentHtml, L));
  const bodyCanvas = await captureElement(bodyContainer);
  const { heightMM: totalBodyMM } = canvasToMM(bodyCanvas, CONTENT_WIDTH);
  document.body.removeChild(bodyContainer);

  const totalPages = Math.max(1, Math.ceil(totalBodyMM / BODY_AREA));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Step 2: Render pages ──
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // -- Header --
    const headerEl = createOffscreen(buildHeaderHtml(displayName, documentTitle, date, L));
    const headerCanvas = await captureElement(headerEl);
    const headerDims = canvasToMM(headerCanvas, CONTENT_WIDTH);
    pdf.addImage(
      headerCanvas.toDataURL('image/png'),
      'PNG',
      MARGIN_LEFT,
      MARGIN_TOP,
      headerDims.widthMM,
      headerDims.heightMM
    );
    document.body.removeChild(headerEl);

    // -- Footer --
    const footerEl = createOffscreen(buildFooterHtml(qrDataUrl, validatorCode, page + 1, String(totalPages), L));
    const footerCanvas = await captureElement(footerEl);
    const footerDims = canvasToMM(footerCanvas, CONTENT_WIDTH);
    const footerY = A4_HEIGHT_MM - MARGIN_BOTTOM - footerDims.heightMM;
    pdf.addImage(
      footerCanvas.toDataURL('image/png'),
      'PNG',
      MARGIN_LEFT,
      footerY,
      footerDims.widthMM,
      footerDims.heightMM
    );
    document.body.removeChild(footerEl);

    // -- Body slice --
    const bodyStartMM = page * BODY_AREA;
    const bodySliceMM = Math.min(BODY_AREA, totalBodyMM - bodyStartMM);
    const bodyTopY = MARGIN_TOP + headerDims.heightMM + SECTION_GAP;

    if (bodySliceMM > 0) {
      const scale = 2;
      const pxPerMM = (bodyCanvas.width / scale) / CONTENT_WIDTH;
      const sliceStartPx = Math.round(bodyStartMM * pxPerMM * scale);
      const sliceHeightPx = Math.round(bodySliceMM * pxPerMM * scale);

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
        MARGIN_LEFT,
        bodyTopY,
        CONTENT_WIDTH,
        bodySliceMM
      );
    }

    // -- Watermark --
    if (L.watermarkEnabled) {
      const wmOpacity = L.watermarkOpacity ?? 0.08;
      const wmRotation = L.watermarkRotation ?? -30;
      const wmColor = L.watermarkColor || '#000000';
      const wmType = L.watermarkType || 'text';

      if (wmType === 'text' && L.watermarkText) {
        const wmFontSize = L.watermarkFontSize || 60;
        pdf.saveGraphicsState();
        // @ts-ignore — jsPDF GState
        pdf.setGState(new (pdf as any).GState({ opacity: wmOpacity }));
        pdf.setFontSize(wmFontSize);
        pdf.setTextColor(wmColor);

        if (L.watermarkPosition === 'tiled') {
          for (let y = 30; y < A4_HEIGHT_MM; y += 60) {
            for (let x = -30; x < A4_WIDTH_MM + 30; x += 100) {
              pdf.text(L.watermarkText, x, y, { angle: wmRotation });
            }
          }
        } else {
          const cx = A4_WIDTH_MM / 2;
          const cy = A4_HEIGHT_MM / 2;
          pdf.text(L.watermarkText, cx, cy, { angle: wmRotation, align: 'center' });
        }
        pdf.restoreGraphicsState();
      }

      if (wmType === 'image' && L.watermarkImageUrl) {
        try {
          pdf.saveGraphicsState();
          // @ts-ignore
          pdf.setGState(new (pdf as any).GState({ opacity: wmOpacity }));
          const imgW = 80;
          const imgH = 80;
          const imgX = (A4_WIDTH_MM - imgW) / 2;
          const imgY = (A4_HEIGHT_MM - imgH) / 2;
          pdf.addImage(L.watermarkImageUrl, 'PNG', imgX, imgY, imgW, imgH);
          pdf.restoreGraphicsState();
        } catch { /* skip if image fails */ }
      }

      if (wmType === 'background' && L.watermarkImageUrl) {
        try {
          if (L.watermarkImageUrl.startsWith('#')) {
            pdf.saveGraphicsState();
            // @ts-ignore
            pdf.setGState(new (pdf as any).GState({ opacity: wmOpacity }));
            const hex = L.watermarkImageUrl;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            pdf.setFillColor(r, g, b);
            pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, 'F');
            pdf.restoreGraphicsState();
          } else {
            pdf.saveGraphicsState();
            // @ts-ignore
            pdf.setGState(new (pdf as any).GState({ opacity: wmOpacity }));
            pdf.addImage(L.watermarkImageUrl, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
            pdf.restoreGraphicsState();
          }
        } catch { /* skip */ }
      }
    }
  }

  // ── Step 3: Save ──
  const slug = documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  pdf.save(`${slug}.pdf`);
}
