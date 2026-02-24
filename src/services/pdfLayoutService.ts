/**
 * PDF Layout Service — Fetches active layout config and applies to PDF generator.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PdfLayoutConfig } from '@/pages/PdfLayoutSettings';

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
export function layoutToGeneratorConfig(layout: PdfLayoutConfig) {
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
  };
}
