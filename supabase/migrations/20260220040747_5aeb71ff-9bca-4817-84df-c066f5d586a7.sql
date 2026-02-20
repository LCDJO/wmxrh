
CREATE TABLE public.career_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_origem_id UUID NOT NULL REFERENCES public.career_positions(id) ON DELETE CASCADE,
  cargo_destino_id UUID NOT NULL REFERENCES public.career_positions(id) ON DELETE CASCADE,
  requisitos TEXT,
  tempo_minimo_meses INT NOT NULL DEFAULT 12,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT career_tracks_no_self CHECK (cargo_origem_id <> cargo_destino_id)
);

ALTER TABLE public.career_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_tracks" ON public.career_tracks
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE UNIQUE INDEX idx_career_tracks_unique ON public.career_tracks(tenant_id, cargo_origem_id, cargo_destino_id) WHERE ativo = true;
CREATE INDEX idx_career_tracks_origem ON public.career_tracks(tenant_id, cargo_origem_id);

CREATE TRIGGER update_career_tracks_updated_at BEFORE UPDATE ON public.career_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
