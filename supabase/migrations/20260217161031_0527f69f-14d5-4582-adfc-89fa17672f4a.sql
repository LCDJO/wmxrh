
-- Landing page A/B experiments
CREATE TABLE public.landing_experiments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'finished')),
  traffic_split_strategy TEXT NOT NULL DEFAULT 'equal' CHECK (traffic_split_strategy IN ('equal', 'weighted', 'multi_armed_bandit')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_experiments ENABLE ROW LEVEL SECURITY;

-- Only platform users can manage experiments
CREATE POLICY "Platform users can view experiments"
  ON public.landing_experiments FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert experiments"
  ON public.landing_experiments FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update experiments"
  ON public.landing_experiments FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can delete experiments"
  ON public.landing_experiments FOR DELETE
  USING (public.is_active_platform_user(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_landing_experiments_updated_at
  BEFORE UPDATE ON public.landing_experiments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for lookups by landing page
CREATE INDEX idx_landing_experiments_page ON public.landing_experiments (landing_page_id);
CREATE INDEX idx_landing_experiments_status ON public.landing_experiments (status);
