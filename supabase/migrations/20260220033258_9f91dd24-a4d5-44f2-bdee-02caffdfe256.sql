
-- Add EPI Product Master fields to existing epi_catalog table
ALTER TABLE public.epi_catalog
  ADD COLUMN IF NOT EXISTS vida_util_dias INTEGER,
  ADD COLUMN IF NOT EXISTS exige_lote BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rastreavel_individualmente BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.epi_catalog.vida_util_dias IS 'Vida útil do EPI em dias a partir da entrega';
COMMENT ON COLUMN public.epi_catalog.exige_lote IS 'Se true, entrega exige informar lote';
COMMENT ON COLUMN public.epi_catalog.rastreavel_individualmente IS 'Se true, cada unidade possui serial number individual';
