
-- ═══════════════════════════════════════════════════════════
-- ADS MANAGEMENT PLATFORM — Database Schema
-- ═══════════════════════════════════════════════════════════

-- 1. Placements (reference table)
CREATE TABLE public.ads_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_placements ENABLE ROW LEVEL SECURITY;

-- Platform users can read/write
CREATE POLICY "Platform users can manage placements"
  ON public.ads_placements FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- Seed default placements
INSERT INTO public.ads_placements (name, label) VALUES
  ('login_screen', 'Tela de Login'),
  ('dashboard_home', 'Dashboard Principal'),
  ('sidebar', 'Sidebar'),
  ('top_banner', 'Banner Topo'),
  ('tenant_dashboard', 'Dashboard do Tenant'),
  ('module_page', 'Página de Módulo'),
  ('widget_area', 'Área de Widgets'),
  ('footer_banner', 'Banner Rodapé'),
  ('modal_popup', 'Modal Popup');

-- 2. Campaigns
CREATE TABLE public.ads_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 10,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can manage campaigns"
  ON public.ads_campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- 3. Creatives
CREATE TABLE public.ads_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  placement_id UUID REFERENCES public.ads_placements(id),
  type TEXT NOT NULL DEFAULT 'banner' CHECK (type IN ('banner', 'popup', 'widget', 'modal')),
  title TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  html_content TEXT,
  cta_text TEXT,
  cta_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can manage creatives"
  ON public.ads_creatives FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- 4. Targeting rules
CREATE TABLE public.ads_targeting (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  plan_name TEXT,
  user_role TEXT,
  country TEXT,
  device_type TEXT,
  exclude_premium BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_targeting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can manage targeting"
  ON public.ads_targeting FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- 5. Metrics (impressions & clicks)
CREATE TABLE public.ads_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  creative_id UUID NOT NULL REFERENCES public.ads_creatives(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  placement TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_metrics ENABLE ROW LEVEL SECURITY;

-- Platform users can read all metrics
CREATE POLICY "Platform users can read metrics"
  ON public.ads_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- Any authenticated user can INSERT metrics (impressions/clicks)
CREATE POLICY "Authenticated users can insert metrics"
  ON public.ads_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Frequency cap tracking
CREATE TABLE public.ads_frequency_caps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (campaign_id, user_id)
);

ALTER TABLE public.ads_frequency_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own frequency caps"
  ON public.ads_frequency_caps FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
