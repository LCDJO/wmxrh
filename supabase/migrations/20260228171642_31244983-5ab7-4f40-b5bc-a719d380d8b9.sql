-- Add plan limit columns
ALTER TABLE public.saas_plans
  ADD COLUMN IF NOT EXISTS max_active_users integer,
  ADD COLUMN IF NOT EXISTS max_api_calls integer,
  ADD COLUMN IF NOT EXISTS max_workflows integer,
  ADD COLUMN IF NOT EXISTS max_storage_mb integer;

-- Seed limits per plan tier
UPDATE public.saas_plans SET
  max_active_users = 2, max_api_calls = 100, max_workflows = 3, max_storage_mb = 500
WHERE name = 'Free';

UPDATE public.saas_plans SET
  max_active_users = 10, max_api_calls = 5000, max_workflows = 20, max_storage_mb = 5000
WHERE name = 'Basic';

UPDATE public.saas_plans SET
  max_active_users = 50, max_api_calls = 50000, max_workflows = 100, max_storage_mb = 25000
WHERE name = 'Pro';

-- Enterprise = unlimited (null)
UPDATE public.saas_plans SET
  max_active_users = NULL, max_api_calls = NULL, max_workflows = NULL, max_storage_mb = NULL
WHERE name = 'Enterprise';

-- DB function: check_plan_limit — generic guard callable from frontend or edge functions
CREATE OR REPLACE FUNCTION public.check_plan_limit(
  p_tenant_id uuid,
  p_limit_key text -- 'employees' | 'active_users' | 'api_calls' | 'workflows' | 'storage_mb'
)
RETURNS jsonb AS $$
DECLARE
  v_plan_id uuid;
  v_max integer;
  v_current integer := 0;
  v_plan_name text;
BEGIN
  -- Get active plan
  SELECT tp.plan_id INTO v_plan_id
  FROM public.tenant_plans tp
  WHERE tp.tenant_id = p_tenant_id AND tp.status IN ('active', 'trial')
  ORDER BY tp.created_at DESC LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'No active plan');
  END IF;

  -- Get limit from plan
  SELECT
    sp.name,
    CASE p_limit_key
      WHEN 'employees' THEN sp.max_employees
      WHEN 'active_users' THEN sp.max_active_users
      WHEN 'api_calls' THEN sp.max_api_calls
      WHEN 'workflows' THEN sp.max_workflows
      WHEN 'storage_mb' THEN sp.max_storage_mb
      ELSE NULL
    END
  INTO v_plan_name, v_max
  FROM public.saas_plans sp WHERE sp.id = v_plan_id;

  -- Unlimited
  IF v_max IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', null, 'remaining', null, 'plan', v_plan_name);
  END IF;

  -- Count current usage
  CASE p_limit_key
    WHEN 'employees' THEN
      SELECT count(*) INTO v_current FROM public.employees WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;
    WHEN 'active_users' THEN
      SELECT count(*) INTO v_current FROM public.user_tenant_roles WHERE tenant_id = p_tenant_id;
    WHEN 'workflows' THEN
      SELECT count(*) INTO v_current FROM public.hiring_processes WHERE tenant_id = p_tenant_id AND status NOT IN ('completed', 'cancelled');
    WHEN 'storage_mb' THEN
      v_current := 0; -- Placeholder: integrate with storage metrics
    WHEN 'api_calls' THEN
      v_current := 0; -- Tracked separately via api_usage_logs
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'Unknown limit key');
  END CASE;

  RETURN jsonb_build_object(
    'allowed', v_current < v_max,
    'current', v_current,
    'max', v_max,
    'remaining', GREATEST(0, v_max - v_current),
    'plan', v_plan_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
