
-- PDF Layout Configurations with versioning
CREATE TABLE public.pdf_layout_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  logo_url TEXT,
  company_name_override TEXT,
  header_subtitle TEXT DEFAULT 'Documento Oficial',
  header_border_color TEXT DEFAULT '#1a1a2e',
  show_logo BOOLEAN DEFAULT true,
  show_date BOOLEAN DEFAULT true,
  
  margin_top NUMERIC DEFAULT 15,
  margin_bottom NUMERIC DEFAULT 15,
  margin_left NUMERIC DEFAULT 15,
  margin_right NUMERIC DEFAULT 15,
  section_gap NUMERIC DEFAULT 3,
  
  header_font_family TEXT DEFAULT 'Helvetica Neue, Arial, sans-serif',
  body_font_family TEXT DEFAULT 'Georgia, Times New Roman, serif',
  footer_font_family TEXT DEFAULT 'Helvetica Neue, Arial, sans-serif',
  header_font_size NUMERIC DEFAULT 16,
  body_font_size NUMERIC DEFAULT 13,
  footer_font_size NUMERIC DEFAULT 9,
  body_line_height NUMERIC DEFAULT 1.7,
  
  show_qr_code BOOLEAN DEFAULT true,
  show_validator_code BOOLEAN DEFAULT true,
  show_page_numbers BOOLEAN DEFAULT true,
  footer_position TEXT DEFAULT 'bottom',
  qr_code_size INTEGER DEFAULT 56,
  footer_text TEXT,
  
  primary_color TEXT DEFAULT '#1a1a2e',
  text_color TEXT DEFAULT '#222222',
  secondary_text_color TEXT DEFAULT '#666666',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.pdf_layout_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pdf layouts in their tenant" ON public.pdf_layout_configs
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage pdf layouts" ON public.pdf_layout_configs
  FOR ALL USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
  ));

CREATE TRIGGER update_pdf_layout_configs_updated_at
  BEFORE UPDATE ON public.pdf_layout_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX idx_pdf_layout_active_per_tenant 
  ON public.pdf_layout_configs (tenant_id) 
  WHERE is_active = true;
