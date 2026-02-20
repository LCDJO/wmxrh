
-- 1. Add 'pending_deletion' to the tenants status check constraint
ALTER TABLE public.tenants DROP CONSTRAINT tenants_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'pending_deletion'::text]));

-- 2. Add scheduled_deletion_at column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz DEFAULT NULL;

-- 3. Create platform_settings table for SaaS configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view settings"
  ON public.platform_settings FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform admins can manage settings"
  ON public.platform_settings FOR ALL
  USING (public.is_active_platform_user(auth.uid()));

-- 4. Seed default tenant deletion retention setting
INSERT INTO public.platform_settings (key, value, label, description, category)
VALUES (
  'tenant_deletion_retention_days',
  '30'::jsonb,
  'Dias de retenção antes da deleção',
  'Quantidade de dias que um tenant permanece em "aguardando deleção" antes de ser removido definitivamente.',
  'tenants'
) ON CONFLICT (key) DO NOTHING;

-- 5. Create trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
