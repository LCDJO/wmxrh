
-- Experience profiles: UI adaptation rules per plan tier
CREATE TABLE public.experience_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Navigation
  visible_navigation TEXT[] NOT NULL DEFAULT '{}',
  hidden_navigation TEXT[] NOT NULL DEFAULT '{}',
  locked_navigation JSONB NOT NULL DEFAULT '[]',
  -- Widgets & dashboard
  available_widgets TEXT[] NOT NULL DEFAULT '{}',
  default_dashboard_layout JSONB NOT NULL DEFAULT '{}',
  -- UI feature toggles
  ui_features JSONB NOT NULL DEFAULT '{}',
  -- Branding (enterprise)
  branding JSONB DEFAULT NULL,
  -- Cognitive hints config
  cognitive_hints_enabled BOOLEAN NOT NULL DEFAULT true,
  cognitive_context_level TEXT NOT NULL DEFAULT 'basic' CHECK (cognitive_context_level IN ('none', 'basic', 'advanced', 'full')),
  -- Metadata
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE public.experience_profiles ENABLE ROW LEVEL SECURITY;

-- Read: tenant members
CREATE POLICY "Users can view their experience profile"
  ON public.experience_profiles FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Write: superadmin only
CREATE POLICY "Platform admins can manage experience profiles"
  ON public.experience_profiles FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
  ));

CREATE TRIGGER update_experience_profiles_updated_at
  BEFORE UPDATE ON public.experience_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync experience profile from plan
CREATE OR REPLACE FUNCTION public.sync_experience_profile(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_plan_name TEXT;
  v_modules TEXT[];
BEGIN
  SELECT tp.plan_id INTO v_plan_id
  FROM public.tenant_plans tp
  WHERE tp.tenant_id = p_tenant_id AND tp.status IN ('active', 'trial')
  LIMIT 1;

  IF v_plan_id IS NULL THEN RETURN; END IF;

  SELECT name INTO v_plan_name FROM public.saas_plans WHERE id = v_plan_id;
  SELECT array_agg(module_key) INTO v_modules FROM public.tenant_module_access WHERE tenant_id = p_tenant_id;

  INSERT INTO public.experience_profiles (
    plan_id, tenant_id, visible_navigation, hidden_navigation,
    available_widgets, ui_features, cognitive_hints_enabled, cognitive_context_level
  ) VALUES (
    v_plan_id,
    p_tenant_id,
    COALESCE(v_modules, '{}'),
    '{}',
    CASE v_plan_name
      WHEN 'Basic' THEN ARRAY['employee_count','department_summary']
      WHEN 'Pro' THEN ARRAY['employee_count','department_summary','compensation_overview','compliance_status','payroll_preview']
      ELSE ARRAY['employee_count','department_summary','compensation_overview','compliance_status','payroll_preview','workforce_intelligence','risk_heatmap','cost_projection']
    END,
    jsonb_build_object(
      'show_upgrade_prompts', v_plan_name != 'Enterprise',
      'enable_custom_branding', v_plan_name = 'Enterprise',
      'enable_advanced_filters', v_plan_name IN ('Pro','Enterprise'),
      'enable_export', v_plan_name IN ('Pro','Enterprise'),
      'enable_bulk_actions', v_plan_name = 'Enterprise'
    ),
    true,
    CASE v_plan_name
      WHEN 'Basic' THEN 'basic'
      WHEN 'Pro' THEN 'advanced'
      ELSE 'full'
    END
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    visible_navigation = EXCLUDED.visible_navigation,
    available_widgets = EXCLUDED.available_widgets,
    ui_features = EXCLUDED.ui_features,
    cognitive_context_level = EXCLUDED.cognitive_context_level,
    updated_at = now();
END;
$$;

-- Auto-sync when module access changes
CREATE OR REPLACE FUNCTION public.trigger_sync_experience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_experience_profile(NEW.tenant_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_experience_on_plan_change
  AFTER INSERT OR UPDATE ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_experience();

-- Seed existing tenants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tenant_id FROM public.tenant_plans LOOP
    PERFORM public.sync_experience_profile(r.tenant_id);
  END LOOP;
END;
$$;
