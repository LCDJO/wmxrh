
-- ══════════════════════════════════════════════════════════
-- Live Operations Display Engine — Database Schema
-- ══════════════════════════════════════════════════════════

-- Enum for display layout presets
CREATE TYPE public.display_layout AS ENUM ('operations', 'compliance', 'overview');

-- Enum for display status
CREATE TYPE public.display_status AS ENUM ('active', 'paused', 'disconnected');

-- ── Main displays table ──
CREATE TABLE public.live_displays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  layout public.display_layout NOT NULL DEFAULT 'overview',
  company_id UUID REFERENCES public.companies(id),
  department_id UUID REFERENCES public.departments(id),
  status public.display_status NOT NULL DEFAULT 'disconnected',
  refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
  last_seen_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── Display access tokens (for TV pairing) ──
CREATE TABLE public.live_display_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_id UUID NOT NULL REFERENCES public.live_displays(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  paired_at TIMESTAMPTZ,
  paired_ip TEXT,
  paired_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_live_displays_tenant ON public.live_displays(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_live_display_tokens_token ON public.live_display_tokens(token) WHERE is_active = true;
CREATE INDEX idx_live_display_tokens_display ON public.live_display_tokens(display_id);

-- ── RLS ──
ALTER TABLE public.live_displays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_display_tokens ENABLE ROW LEVEL SECURITY;

-- Displays: tenant members can manage
CREATE POLICY "Tenant members can view displays"
  ON public.live_displays FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Tenant admins can insert displays"
  ON public.live_displays FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update displays"
  ON public.live_displays FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete displays"
  ON public.live_displays FOR DELETE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- Tokens: tenant members can view, admins manage
CREATE POLICY "Tenant members can view tokens"
  ON public.live_display_tokens FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can insert tokens"
  ON public.live_display_tokens FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update tokens"
  ON public.live_display_tokens FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_live_displays_updated_at
  BEFORE UPDATE ON public.live_displays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for displays (status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_displays;
