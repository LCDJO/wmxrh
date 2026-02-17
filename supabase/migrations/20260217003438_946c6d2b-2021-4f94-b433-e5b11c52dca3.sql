
-- ══════════════════════════════════════════════════════════════
-- TenantCommunicationCenter — Schema Evolution
-- Adds subcategory taxonomy, source tracking, and auto-alert support
-- ══════════════════════════════════════════════════════════════

-- 1. Add new columns to platform_announcements
ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_resolve_on text;

-- 2. Add validation trigger for source
CREATE OR REPLACE FUNCTION public.validate_announcement_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source NOT IN ('manual', 'automatic', 'system') THEN
    RAISE EXCEPTION 'Invalid announcement source: %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_announcement_source ON public.platform_announcements;
CREATE TRIGGER trg_validate_announcement_source
  BEFORE INSERT OR UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION public.validate_announcement_source();

-- 3. Index for efficient subcategory filtering
CREATE INDEX IF NOT EXISTS idx_announcements_subcategory ON public.platform_announcements (category, subcategory);
CREATE INDEX IF NOT EXISTS idx_announcements_source ON public.platform_announcements (source);

-- 4. Function: Generate billing alerts automatically
CREATE OR REPLACE FUNCTION public.generate_billing_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _sub RECORD;
BEGIN
  -- Check for subscriptions expiring within 7 days
  FOR _sub IN
    SELECT ts.*, t.name as tenant_name
    FROM public.tenant_subscriptions ts
    JOIN public.tenants t ON t.id = ts.tenant_id
    WHERE ts.status = 'active'
      AND ts.current_period_end IS NOT NULL
      AND ts.current_period_end <= now() + interval '7 days'
      AND ts.current_period_end > now()
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_announcements pa
        WHERE pa.tenant_id = ts.tenant_id
          AND pa.category = 'billing'
          AND pa.subcategory = 'plan_expiring'
          AND pa.source = 'automatic'
          AND pa.is_active = true
      )
  LOOP
    INSERT INTO public.platform_announcements (
      tenant_id, title, description, category, subcategory, priority,
      source, is_dismissible, show_banner, starts_at, metadata
    ) VALUES (
      _sub.tenant_id,
      'Plano próximo do vencimento',
      'Seu plano ' || COALESCE(_sub.plan::text, 'atual') || ' vence em breve. Renove para evitar interrupção.',
      'billing', 'plan_expiring', 'high',
      'automatic', false, true, now(),
      jsonb_build_object('subscription_id', _sub.id, 'expires_at', _sub.current_period_end)
    );
  END LOOP;

  -- Check for overdue payments (past_due status)
  FOR _sub IN
    SELECT ts.*, t.name as tenant_name
    FROM public.tenant_subscriptions ts
    JOIN public.tenants t ON t.id = ts.tenant_id
    WHERE ts.status = 'past_due'
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_announcements pa
        WHERE pa.tenant_id = ts.tenant_id
          AND pa.category = 'billing'
          AND pa.subcategory = 'payment_overdue'
          AND pa.source = 'automatic'
          AND pa.is_active = true
      )
  LOOP
    INSERT INTO public.platform_announcements (
      tenant_id, title, description, category, subcategory, priority,
      source, is_dismissible, show_banner, starts_at, metadata
    ) VALUES (
      _sub.tenant_id,
      'Pagamento em atraso',
      'Existe um pagamento pendente. Regularize para manter o acesso completo.',
      'billing', 'payment_overdue', 'critical',
      'automatic', false, true, now(),
      jsonb_build_object('subscription_id', _sub.id)
    );
  END LOOP;
END;
$$;

-- 5. RLS policy for platform users to manage announcements
CREATE POLICY "Platform users can manage all announcements"
  ON public.platform_announcements
  FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));
