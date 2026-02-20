-- Add missing legal audit columns to epi_audit_log
ALTER TABLE public.epi_audit_log ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.epi_audit_log ADD COLUMN IF NOT EXISTS hash_documento text;
ALTER TABLE public.epi_audit_log ADD COLUMN IF NOT EXISTS epi_catalog_id uuid REFERENCES public.epi_catalog(id);
