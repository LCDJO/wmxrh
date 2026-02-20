
-- EPI Inventory Audit Log (append-only, immutable)
CREATE TABLE IF NOT EXISTS public.epi_inventory_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  inventory_id UUID REFERENCES public.epi_inventory(id),
  epi_catalog_id UUID REFERENCES public.epi_catalog(id),
  warehouse_id UUID REFERENCES public.epi_warehouses(id),
  lot_id UUID REFERENCES public.epi_lots(id),
  action TEXT NOT NULL, -- 'entrada', 'saida_entrega', 'devolucao', 'ajuste_manual', 'transferencia', 'descarte', 'correcao'
  usuario_id UUID,
  usuario_email TEXT,
  quantidade_antes INTEGER NOT NULL DEFAULT 0,
  quantidade_depois INTEGER NOT NULL DEFAULT 0,
  diferenca INTEGER GENERATED ALWAYS AS (quantidade_depois - quantidade_antes) STORED,
  reference_type TEXT, -- 'delivery', 'return', 'manual', 'movement', 'incident'
  reference_id UUID,
  motivo TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_epi_inv_audit_tenant ON public.epi_inventory_audit_log(tenant_id);
CREATE INDEX idx_epi_inv_audit_inventory ON public.epi_inventory_audit_log(inventory_id);
CREATE INDEX idx_epi_inv_audit_created ON public.epi_inventory_audit_log(created_at DESC);
CREATE INDEX idx_epi_inv_audit_action ON public.epi_inventory_audit_log(action);

-- RLS
ALTER TABLE public.epi_inventory_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view audit log"
  ON public.epi_inventory_audit_log FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

-- NO INSERT/UPDATE/DELETE policies for users — only SECURITY DEFINER functions can write

-- Prevent updates (immutable)
CREATE OR REPLACE FUNCTION public.fn_prevent_epi_audit_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EPI inventory audit log is immutable. Updates are not allowed.';
END;
$$;

CREATE TRIGGER trg_prevent_epi_inv_audit_update
  BEFORE UPDATE ON public.epi_inventory_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_epi_audit_update();

-- Prevent deletes (immutable)
CREATE OR REPLACE FUNCTION public.fn_prevent_epi_audit_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EPI inventory audit log is immutable. Deletions are not allowed.';
END;
$$;

CREATE TRIGGER trg_prevent_epi_inv_audit_delete
  BEFORE DELETE ON public.epi_inventory_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_epi_audit_delete();

-- Auto-log on epi_inventory changes
CREATE OR REPLACE FUNCTION public.fn_epi_inventory_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _action TEXT;
  _qty_before INT;
  _qty_after INT;
  _user_id UUID;
  _user_email TEXT;
BEGIN
  _user_id := auth.uid();
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF TG_OP = 'INSERT' THEN
    _action := 'entrada';
    _qty_before := 0;
    _qty_after := NEW.quantidade_disponivel;
  ELSIF TG_OP = 'UPDATE' THEN
    _qty_before := OLD.quantidade_disponivel;
    _qty_after := NEW.quantidade_disponivel;
    IF _qty_after > _qty_before THEN
      _action := 'entrada';
    ELSIF _qty_after < _qty_before THEN
      _action := 'saida_entrega';
    ELSE
      RETURN NEW; -- no quantity change, skip
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'descarte';
    _qty_before := OLD.quantidade_disponivel;
    _qty_after := 0;
  END IF;

  INSERT INTO public.epi_inventory_audit_log
    (tenant_id, inventory_id, epi_catalog_id, warehouse_id, lot_id, action, usuario_id, usuario_email, quantidade_antes, quantidade_depois, reference_type, motivo)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.epi_catalog_id, OLD.epi_catalog_id),
    COALESCE(NEW.warehouse_id, OLD.warehouse_id),
    COALESCE(NEW.lot_id, OLD.lot_id),
    _action,
    _user_id,
    _user_email,
    _qty_before,
    _qty_after,
    'movement',
    CASE WHEN TG_OP = 'INSERT' THEN 'Registro inicial de estoque'
         WHEN TG_OP = 'DELETE' THEN 'Registro removido'
         ELSE 'Atualização de quantidade' END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_epi_inventory_audit ON public.epi_inventory;
CREATE TRIGGER trg_epi_inventory_audit
  AFTER INSERT OR UPDATE OF quantidade_disponivel OR DELETE ON public.epi_inventory
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_inventory_audit_log();
