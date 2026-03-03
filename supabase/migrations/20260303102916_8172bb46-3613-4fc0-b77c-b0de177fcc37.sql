
CREATE TABLE public.navigation_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number INTEGER NOT NULL DEFAULT 1,
  context TEXT NOT NULL CHECK (context IN ('saas', 'tenant')),
  tree_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_navigation_versions_context ON public.navigation_versions(context);
CREATE INDEX idx_navigation_versions_created_at ON public.navigation_versions(created_at DESC);

ALTER TABLE public.navigation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage navigation versions"
  ON public.navigation_versions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'superadmin')
    )
  );

CREATE POLICY "Authenticated users can read navigation versions"
  ON public.navigation_versions
  FOR SELECT
  TO authenticated
  USING (true);
