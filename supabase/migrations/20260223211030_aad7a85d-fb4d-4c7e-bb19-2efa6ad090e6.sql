
-- Add missing columns to document_vault for full audit compliance
ALTER TABLE public.document_vault
  ADD COLUMN IF NOT EXISTS versao integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ip_assinatura text;
