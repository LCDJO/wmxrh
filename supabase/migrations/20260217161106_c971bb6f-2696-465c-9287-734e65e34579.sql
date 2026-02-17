
-- Landing page A/B test variants
CREATE TABLE public.landing_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.landing_experiments(id) ON DELETE CASCADE,
  version_id TEXT,
  weight_percentage INTEGER NOT NULL DEFAULT 50 CHECK (weight_percentage >= 0 AND weight_percentage <= 100),
  fab_structure_snapshot JSONB DEFAULT '{}'::jsonb,
  headline_variant TEXT,
  cta_variant TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sticky visitor-to-variant allocations
CREATE TABLE public.landing_traffic_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.landing_experiments(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  variant_id UUID NOT NULL REFERENCES public.landing_variants(id) ON DELETE CASCADE,
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, visitor_id)
);

-- RLS
ALTER TABLE public.landing_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_traffic_allocations ENABLE ROW LEVEL SECURITY;

-- Variants: platform users only
CREATE POLICY "Platform users manage variants"
  ON public.landing_variants FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Traffic allocations: platform users can read; inserts are open (edge function / anon for visitor tracking)
CREATE POLICY "Platform users view allocations"
  ON public.landing_traffic_allocations FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Anyone can insert allocation"
  ON public.landing_traffic_allocations FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_landing_variants_experiment ON public.landing_variants (experiment_id);
CREATE INDEX idx_traffic_alloc_lookup ON public.landing_traffic_allocations (experiment_id, visitor_id);

-- Auto-update timestamp
CREATE TRIGGER update_landing_variants_updated_at
  BEFORE UPDATE ON public.landing_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
