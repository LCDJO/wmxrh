
-- Legal Interpretation Audit Log (append-only, immutable)
CREATE TABLE public.legal_interpretation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  mudanca_id TEXT NOT NULL,
  norm_codigo TEXT,
  resumo TEXT NOT NULL,
  impacto JSONB NOT NULL DEFAULT '{}',
  acoes_geradas JSONB NOT NULL DEFAULT '[]',
  risco_nivel TEXT NOT NULL DEFAULT 'medio',
  modelo_utilizado TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_interp_logs_tenant ON public.legal_interpretation_logs(tenant_id);
CREATE INDEX idx_legal_interp_logs_mudanca ON public.legal_interpretation_logs(mudanca_id);
CREATE INDEX idx_legal_interp_logs_created ON public.legal_interpretation_logs(created_at DESC);

ALTER TABLE public.legal_interpretation_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant admins
CREATE POLICY "Tenant admins can view interpretation logs"
  ON public.legal_interpretation_logs FOR SELECT
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- INSERT via SECURITY DEFINER function (append-only)
CREATE OR REPLACE FUNCTION public.insert_legal_interpretation_log(
  p_tenant_id UUID,
  p_mudanca_id TEXT,
  p_norm_codigo TEXT,
  p_resumo TEXT,
  p_impacto JSONB,
  p_acoes_geradas JSONB,
  p_risco_nivel TEXT DEFAULT 'medio',
  p_modelo_utilizado TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.legal_interpretation_logs (
    tenant_id, mudanca_id, norm_codigo, resumo, impacto, acoes_geradas, risco_nivel, modelo_utilizado, created_by
  ) VALUES (
    p_tenant_id, p_mudanca_id, p_norm_codigo, p_resumo, p_impacto, p_acoes_geradas, p_risco_nivel, p_modelo_utilizado, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Block UPDATE and DELETE (immutable)
CREATE POLICY "Block interpretation log updates"
  ON public.legal_interpretation_logs FOR UPDATE USING (false);

CREATE POLICY "Block interpretation log deletes"
  ON public.legal_interpretation_logs FOR DELETE USING (false);
