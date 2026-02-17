
-- ══════════════════════════════════════════════════════════════
-- Platform Announcements — Institutional alerts from SaaS to Tenants
-- ══════════════════════════════════════════════════════════════

-- Category enum
CREATE TYPE public.announcement_category AS ENUM (
  'maintenance',
  'update',
  'billing',
  'security',
  'compliance',
  'general'
);

-- Priority enum  
CREATE TYPE public.announcement_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Main table
CREATE TABLE public.platform_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Targeting: NULL = global (all tenants)
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category announcement_category NOT NULL DEFAULT 'general',
  priority announcement_priority NOT NULL DEFAULT 'medium',
  
  -- Display control
  action_url TEXT,
  action_label TEXT,
  is_dismissible BOOLEAN NOT NULL DEFAULT true,
  show_banner BOOLEAN NOT NULL DEFAULT true,
  
  -- Lifecycle
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Authorship (platform user)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dismissals per user
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

-- Indexes
CREATE INDEX idx_announcements_active ON public.platform_announcements (is_active, starts_at, expires_at);
CREATE INDEX idx_announcements_tenant ON public.platform_announcements (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_dismissals_user ON public.announcement_dismissals (user_id);

-- Updated_at trigger
CREATE TRIGGER update_platform_announcements_updated_at
  BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Platform users can CRUD announcements
CREATE POLICY "Platform users manage announcements"
  ON public.platform_announcements FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Tenant users can read active announcements targeted to them or global
CREATE POLICY "Tenant users read active announcements"
  ON public.platform_announcements FOR SELECT
  USING (
    is_active = true
    AND starts_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      tenant_id IS NULL  -- global
      OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
  );

-- Users can manage their own dismissals
CREATE POLICY "Users manage own dismissals"
  ON public.announcement_dismissals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements;
