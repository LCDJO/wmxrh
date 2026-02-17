
-- ══════════════════════════════════════════════════════════════
-- TenantAnnouncement — Clean refactor from platform_announcements
-- ══════════════════════════════════════════════════════════════

-- 1. Drop ALL policies on original table
DROP POLICY IF EXISTS "Tenant members can view relevant announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Tenant users read active announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Platform users can manage all announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Platform users can manage announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Tenant members can view their announcements" ON public.platform_announcements;

-- 2. Drop triggers
DROP TRIGGER IF EXISTS trg_validate_announcement_source ON public.platform_announcements;
DROP FUNCTION IF EXISTS public.validate_announcement_source();

-- 3. Drop old indexes
DROP INDEX IF EXISTS idx_announcements_subcategory;
DROP INDEX IF EXISTS idx_announcements_source;

-- 4. Drop FK from dismissals
ALTER TABLE public.announcement_dismissals
  DROP CONSTRAINT IF EXISTS announcement_dismissals_announcement_id_fkey;

-- 5. Drop old table entirely (empty, no data loss)
DROP TABLE IF EXISTS public.platform_announcements CASCADE;

-- 6. Create tenant_announcements with exact spec
CREATE TABLE public.tenant_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  title text NOT NULL,
  message text NOT NULL,
  alert_type text NOT NULL DEFAULT 'system',
  severity text NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT 'saas_management',
  action_url text,
  blocking_level text NOT NULL DEFAULT 'none',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  is_dismissible boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Validation trigger
CREATE OR REPLACE FUNCTION public.validate_tenant_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.alert_type NOT IN ('billing', 'fiscal', 'system', 'security') THEN
    RAISE EXCEPTION 'Invalid alert_type: %', NEW.alert_type;
  END IF;
  IF NEW.severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Invalid severity: %', NEW.severity;
  END IF;
  IF NEW.blocking_level NOT IN ('none', 'banner', 'restricted_access') THEN
    RAISE EXCEPTION 'Invalid blocking_level: %', NEW.blocking_level;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_announcement
  BEFORE INSERT OR UPDATE ON public.tenant_announcements
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_announcement();

-- 8. updated_at trigger
CREATE TRIGGER update_tenant_announcements_updated_at
  BEFORE UPDATE ON public.tenant_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Indexes
CREATE INDEX idx_tenant_announcements_alert_type ON public.tenant_announcements (alert_type);
CREATE INDEX idx_tenant_announcements_severity ON public.tenant_announcements (severity);
CREATE INDEX idx_tenant_announcements_blocking ON public.tenant_announcements (blocking_level);
CREATE INDEX idx_tenant_announcements_tenant ON public.tenant_announcements (tenant_id, start_at);

-- 10. RLS
ALTER TABLE public.tenant_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their announcements"
  ON public.tenant_announcements FOR SELECT
  USING (
    tenant_id IS NULL
    OR public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_active_platform_user(auth.uid())
  );

CREATE POLICY "Platform users can manage announcements"
  ON public.tenant_announcements FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- 11. Re-link dismissals FK
ALTER TABLE public.announcement_dismissals
  ADD CONSTRAINT announcement_dismissals_announcement_id_fkey
  FOREIGN KEY (announcement_id) REFERENCES public.tenant_announcements(id) ON DELETE CASCADE;

-- 12. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_announcements;
