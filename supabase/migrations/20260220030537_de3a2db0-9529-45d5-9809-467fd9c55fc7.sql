
-- Add missing columns to epi_catalog per requirements
ALTER TABLE public.epi_catalog
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'protecao_individual',
  ADD COLUMN IF NOT EXISTS exige_termo_assinatura boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS periodicidade_substituicao_dias integer,
  ADD COLUMN IF NOT EXISTS risco_relacionado text[] NOT NULL DEFAULT '{}';

-- Create validation trigger: prevent delivery of expired CA
CREATE OR REPLACE FUNCTION public.fn_validate_epi_ca_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ca_validade date;
  _ca_numero text;
BEGIN
  SELECT ca_validade, ca_numero INTO _ca_validade, _ca_numero
  FROM public.epi_catalog WHERE id = NEW.epi_catalog_id;

  IF _ca_numero IS NULL OR _ca_numero = '' THEN
    RAISE EXCEPTION 'EPI sem número de CA válido. CA é obrigatório para entrega.';
  END IF;

  IF _ca_validade IS NOT NULL AND _ca_validade < CURRENT_DATE THEN
    RAISE EXCEPTION 'CA % vencido em %. Não é permitido entregar EPI com CA inválido.', _ca_numero, _ca_validade;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to epi_deliveries
DROP TRIGGER IF EXISTS trg_validate_epi_ca_on_delivery ON public.epi_deliveries;
CREATE TRIGGER trg_validate_epi_ca_on_delivery
  BEFORE INSERT ON public.epi_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_epi_ca_on_delivery();
