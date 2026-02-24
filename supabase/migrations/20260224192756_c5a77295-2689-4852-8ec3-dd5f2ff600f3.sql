
ALTER TABLE public.pdf_layout_configs 
  ADD COLUMN qr_position text NOT NULL DEFAULT 'left',
  ADD COLUMN pagination_location text NOT NULL DEFAULT 'footer',
  ADD COLUMN header_extra_text text,
  ADD COLUMN footer_show_doc_name boolean NOT NULL DEFAULT false,
  ADD COLUMN footer_show_validator_link boolean NOT NULL DEFAULT false;
