
-- Website Platform Core — persistent website entity
CREATE TABLE public.websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'maintenance', 'archived')),
  theme JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique domain constraint
CREATE UNIQUE INDEX idx_websites_domain ON public.websites (domain);

-- Enable RLS
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- Only platform users can manage websites
CREATE POLICY "Platform users can view websites"
  ON public.websites FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can create websites"
  ON public.websites FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update websites"
  ON public.websites FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can delete websites"
  ON public.websites FOR DELETE
  USING (public.is_active_platform_user(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
