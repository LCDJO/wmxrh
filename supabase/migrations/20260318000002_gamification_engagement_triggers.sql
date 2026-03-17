
-- ══════════════════════════════════════════════════════════════════
-- Gamification: Module Usage Triggers
--
-- Fires AFTER INSERT on 8 key tables.
-- Awards points to the authenticated user and updates aggregates:
--   1. gamification_points         — individual event log
--   2. gamification_profiles       — user total points + level
--   3. tenant_user_engagement      — per-user per-tenant aggregate
--   4. tenant_usage_scores         — per-tenant adoption metrics
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_gamification_track_module_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id            UUID;
  v_tenant_id          UUID;
  v_action_key         TEXT;
  v_counter_col        TEXT;
  v_module_slug        TEXT;
  v_points             INTEGER;
  v_plan_modules_count INTEGER;
  v_active_modules     TEXT[];
  v_used_modules_count INTEGER;
BEGIN
  v_tenant_id := NEW.tenant_id;

  -- Resolve authenticated user from JWT (PostgREST sets this)
  BEGIN
    v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Map table → action key, counter column, module slug
  CASE TG_TABLE_NAME
    WHEN 'employees' THEN
      v_action_key  := 'module_employee_added';
      v_counter_col := 'employees_count';
      v_module_slug := 'employees';
    WHEN 'companies' THEN
      v_action_key  := 'module_company_added';
      v_counter_col := 'companies_count';
      v_module_slug := 'companies';
    WHEN 'departments' THEN
      v_action_key  := 'module_department_added';
      v_counter_col := 'departments_count';
      v_module_slug := 'departments';
    WHEN 'positions' THEN
      v_action_key  := 'module_position_added';
      v_counter_col := 'positions_count';
      v_module_slug := 'positions';
    WHEN 'salary_contracts' THEN
      v_action_key  := 'module_salary_contract';
      v_counter_col := 'salary_contracts_count';
      v_module_slug := 'compensation';
    WHEN 'ats_candidates' THEN
      v_action_key  := 'module_ats_candidate';
      v_counter_col := 'ats_candidates_count';
      v_module_slug := 'ats';
    WHEN 'performance_review_cycles' THEN
      v_action_key  := 'module_performance_cycle';
      v_counter_col := 'performance_cycles_count';
      v_module_slug := 'performance';
    WHEN 'automation_rules' THEN
      v_action_key  := 'module_automation_rule';
      v_counter_col := 'automation_rules_count';
      v_module_slug := 'automation';
    ELSE
      RETURN NEW;
  END CASE;

  -- Fetch configured points (0 if not found or inactive)
  SELECT COALESCE(points, 0) INTO v_points
  FROM public.gamification_point_weights
  WHERE action_key = v_action_key AND is_active = true;

  v_points := COALESCE(v_points, 0);

  -- ── Per-user updates (only when user is authenticated) ──────────
  IF v_user_id IS NOT NULL THEN

    -- 1. Log event in gamification_points
    IF v_points > 0 THEN
      INSERT INTO public.gamification_points
        (user_id, tenant_id, action, points, source, description)
      VALUES
        (v_user_id, v_tenant_id, v_action_key, v_points,
         'module_usage', 'Módulo: ' || v_module_slug);
    END IF;

    -- 2. Update user's gamification profile (total points)
    INSERT INTO public.gamification_profiles (user_id, total_points, last_activity_at)
    VALUES (v_user_id, v_points, now())
    ON CONFLICT (user_id) DO UPDATE SET
      total_points     = gamification_profiles.total_points + v_points,
      last_activity_at = now(),
      updated_at       = now();

    -- 3. Upsert tenant_user_engagement
    INSERT INTO public.tenant_user_engagement
      (tenant_id, user_id, total_points, actions_count, last_action_at, top_module)
    VALUES
      (v_tenant_id, v_user_id, v_points, 1, now(), v_module_slug)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      total_points   = tenant_user_engagement.total_points + v_points,
      actions_count  = tenant_user_engagement.actions_count + 1,
      last_action_at = now(),
      updated_at     = now();

  END IF;

  -- ── Per-tenant updates (always, regardless of user) ──────────────

  -- 4. Upsert tenant_usage_scores base row
  INSERT INTO public.tenant_usage_scores (tenant_id, total_points, last_event_at)
  VALUES (v_tenant_id, v_points, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    total_points  = tenant_usage_scores.total_points + v_points,
    last_event_at = now(),
    updated_at    = now();

  -- 5. Increment specific module counter
  EXECUTE format(
    'UPDATE public.tenant_usage_scores SET %I = %I + 1 WHERE tenant_id = $1',
    v_counter_col, v_counter_col
  ) USING v_tenant_id;

  -- 6. Recalculate active_modules and adoption_pct
  SELECT COUNT(*) INTO v_plan_modules_count
  FROM public.tenant_module_access
  WHERE tenant_id = v_tenant_id;

  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN employees_count          > 0 THEN 'employees'    END,
    CASE WHEN companies_count          > 0 THEN 'companies'    END,
    CASE WHEN departments_count        > 0 THEN 'departments'  END,
    CASE WHEN positions_count          > 0 THEN 'positions'    END,
    CASE WHEN salary_contracts_count   > 0 THEN 'compensation' END,
    CASE WHEN ats_candidates_count     > 0 THEN 'ats'          END,
    CASE WHEN performance_cycles_count > 0 THEN 'performance'  END,
    CASE WHEN automation_rules_count   > 0 THEN 'automation'   END
  ], NULL)
  INTO v_active_modules
  FROM public.tenant_usage_scores
  WHERE tenant_id = v_tenant_id;

  v_used_modules_count := COALESCE(array_length(v_active_modules, 1), 0);

  UPDATE public.tenant_usage_scores SET
    active_modules     = v_active_modules,
    plan_modules_count = COALESCE(v_plan_modules_count, 0),
    adoption_pct       = CASE
      WHEN COALESCE(v_plan_modules_count, 0) > 0
      THEN LEAST(v_used_modules_count::numeric / v_plan_modules_count::numeric, 1.0)
      ELSE 0
    END
  WHERE tenant_id = v_tenant_id;

  RETURN NEW;
END;
$$;

-- ── Triggers on each module table ────────────────────────────────

CREATE TRIGGER trg_gamification_employees
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_companies
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_departments
  AFTER INSERT ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_positions
  AFTER INSERT ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_salary_contracts
  AFTER INSERT ON public.salary_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_ats_candidates
  AFTER INSERT ON public.ats_candidates
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_performance_cycles
  AFTER INSERT ON public.performance_review_cycles
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();

CREATE TRIGGER trg_gamification_automation_rules
  AFTER INSERT ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamification_track_module_event();
