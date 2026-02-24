
-- Auto-create default PDF layout when a tenant is created
CREATE OR REPLACE FUNCTION public.auto_create_default_pdf_layout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pdf_layout_configs (
    tenant_id, name, version_number, is_active,
    company_name_override, header_subtitle, header_border_color,
    show_logo, show_date,
    margin_top, margin_bottom, margin_left, margin_right, section_gap,
    header_font_family, body_font_family, footer_font_family,
    header_font_size, body_font_size, footer_font_size, body_line_height,
    show_qr_code, show_validator_code, show_page_numbers,
    footer_position, qr_code_size,
    primary_color, text_color, secondary_text_color
  ) VALUES (
    NEW.id, 'Layout Padrão', 1, true,
    NULL, 'Documento Oficial', '#1a1a2e',
    false, true,
    15, 15, 15, 15, 3,
    'Helvetica Neue, Arial, sans-serif', 'Georgia, Times New Roman, serif', 'Helvetica Neue, Arial, sans-serif',
    16, 13, 9, 1.7,
    true, true, true,
    'bottom', 56,
    '#1a1a2e', '#222222', '#666666'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_pdf_layout
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_default_pdf_layout();

-- Backfill: create default layout for existing tenants that don't have one
INSERT INTO public.pdf_layout_configs (
  tenant_id, name, version_number, is_active,
  header_subtitle, header_border_color,
  show_logo, show_date,
  margin_top, margin_bottom, margin_left, margin_right, section_gap,
  header_font_family, body_font_family, footer_font_family,
  header_font_size, body_font_size, footer_font_size, body_line_height,
  show_qr_code, show_validator_code, show_page_numbers,
  footer_position, qr_code_size,
  primary_color, text_color, secondary_text_color
)
SELECT
  t.id, 'Layout Padrão', 1, true,
  'Documento Oficial', '#1a1a2e',
  false, true,
  15, 15, 15, 15, 3,
  'Helvetica Neue, Arial, sans-serif', 'Georgia, Times New Roman, serif', 'Helvetica Neue, Arial, sans-serif',
  16, 13, 9, 1.7,
  true, true, true,
  'bottom', 56,
  '#1a1a2e', '#222222', '#666666'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.pdf_layout_configs p WHERE p.tenant_id = t.id
);
