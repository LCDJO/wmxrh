
-- Add lot_id to epi_deliveries for lot-employee traceability
ALTER TABLE public.epi_deliveries
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.epi_lots(id);

CREATE INDEX IF NOT EXISTS idx_epi_deliveries_lot ON public.epi_deliveries(lot_id);

-- Trigger: Block delivery of expired lot
CREATE OR REPLACE FUNCTION public.fn_block_expired_lot_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lot_validade DATE;
BEGIN
  IF NEW.lot_id IS NOT NULL THEN
    SELECT lote_validade INTO _lot_validade
    FROM public.epi_lots WHERE id = NEW.lot_id;

    IF _lot_validade IS NOT NULL AND _lot_validade < CURRENT_DATE THEN
      RAISE EXCEPTION 'Entrega bloqueada: Lote vencido em %. Não é permitido entregar EPI de lote expirado.', _lot_validade;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_expired_lot_delivery
  BEFORE INSERT ON public.epi_deliveries
  FOR EACH ROW
  WHEN (NEW.lot_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_block_expired_lot_delivery();
