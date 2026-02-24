/**
 * PDF Layout Service — Fetches active layout config and applies to PDF generator.
 * Always returns a usable config (falls back to hardcoded defaults if none in DB).
 */
import { supabase } from '@/integrations/supabase/client';
import type { PdfLayoutConfig } from '@/pages/PdfLayoutSettings';
import type { PdfLayoutOverrides } from '@/services/pdfDocumentGenerator';

const FALLBACK_DEFAULTS: PdfLayoutOverrides = {
  marginTop: 15,
  marginBottom: 15,
  marginLeft: 15,
  marginRight: 15,
  sectionGap: 3,
  headerFontFamily: 'Helvetica Neue, Arial, sans-serif',
  bodyFontFamily: 'Georgia, Times New Roman, serif',
  footerFontFamily: 'Helvetica Neue, Arial, sans-serif',
  headerFontSize: 16,
  bodyFontSize: 13,
  footerFontSize: 9,
  bodyLineHeight: 1.7,
  primaryColor: '#1a1a2e',
  textColor: '#222222',
  secondaryTextColor: '#666666',
  headerBorderColor: '#1a1a2e',
  showLogo: false,
  logoUrl: null,
  companyNameOverride: null,
  headerSubtitle: 'Documento Oficial',
  showDate: true,
  showQrCode: true,
  showValidatorCode: true,
  showPageNumbers: true,
  qrCodeSize: 56,
  footerText: null,
  watermarkEnabled: false,
  watermarkType: 'text',
  watermarkText: null,
  watermarkImageUrl: null,
  watermarkOpacity: 0.08,
  watermarkRotation: -30,
  watermarkFontSize: 60,
  watermarkColor: '#000000',
  watermarkPosition: 'center',
  pageSize: 'a4',
  qrPosition: 'left',
  paginationLocation: 'footer',
  headerExtraText: null,
  footerShowDocName: false,
  footerShowValidatorLink: false,
};

export async function getActivePdfLayout(tenantId: string): Promise<PdfLayoutConfig | null> {
  const { data, error } = await supabase
    .from('pdf_layout_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as PdfLayoutConfig;
}

/** Maps a PdfLayoutConfig to the constants used by pdfDocumentGenerator */
export function layoutToGeneratorConfig(layout: PdfLayoutConfig): PdfLayoutOverrides {
  return {
    marginTop: Number(layout.margin_top) || 15,
    marginBottom: Number(layout.margin_bottom) || 15,
    marginLeft: Number(layout.margin_left) || 15,
    marginRight: Number(layout.margin_right) || 15,
    sectionGap: Number(layout.section_gap) || 3,
    headerFontFamily: layout.header_font_family,
    bodyFontFamily: layout.body_font_family,
    footerFontFamily: layout.footer_font_family,
    headerFontSize: Number(layout.header_font_size),
    bodyFontSize: Number(layout.body_font_size),
    footerFontSize: Number(layout.footer_font_size),
    bodyLineHeight: Number(layout.body_line_height),
    primaryColor: layout.primary_color,
    textColor: layout.text_color,
    secondaryTextColor: layout.secondary_text_color,
    headerBorderColor: layout.header_border_color,
    showLogo: layout.show_logo,
    logoUrl: layout.logo_url,
    companyNameOverride: layout.company_name_override,
    headerSubtitle: layout.header_subtitle,
    showDate: layout.show_date,
    showQrCode: layout.show_qr_code,
    showValidatorCode: layout.show_validator_code,
    showPageNumbers: layout.show_page_numbers,
    qrCodeSize: layout.qr_code_size,
    footerText: layout.footer_text,
    watermarkEnabled: layout.watermark_enabled,
    watermarkType: layout.watermark_type,
    watermarkText: layout.watermark_text,
    watermarkImageUrl: layout.watermark_image_url,
    watermarkOpacity: Number(layout.watermark_opacity),
    watermarkRotation: Number(layout.watermark_rotation),
    watermarkFontSize: Number(layout.watermark_font_size),
    watermarkColor: layout.watermark_color,
    watermarkPosition: layout.watermark_position,
    pageSize: layout.page_size || 'a4',
    qrPosition: layout.qr_position || 'left',
    paginationLocation: layout.pagination_location || 'footer',
    headerExtraText: layout.header_extra_text,
    footerShowDocName: layout.footer_show_doc_name ?? false,
    footerShowValidatorLink: layout.footer_show_validator_link ?? false,
  };
}

/**
 * Returns the active layout for a tenant, or safe fallback defaults.
 * Use this in PDF generation flows to guarantee no null config.
 */
export async function getLayoutOrDefaults(tenantId: string): Promise<PdfLayoutOverrides> {
  const layout = await getActivePdfLayout(tenantId);
  if (layout) return layoutToGeneratorConfig(layout);
  return { ...FALLBACK_DEFAULTS };
}
