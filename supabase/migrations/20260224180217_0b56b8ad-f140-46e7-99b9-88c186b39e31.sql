
-- Add pdf_layout_config_id to agreement_templates
ALTER TABLE public.agreement_templates
  ADD COLUMN pdf_layout_config_id UUID REFERENCES public.pdf_layout_configs(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_agreement_templates_pdf_layout ON public.agreement_templates(pdf_layout_config_id);
