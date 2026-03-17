
-- ══════════════════════════════════════════════════════════════════
-- Gamification: Product Engagement System
--
-- Extends the existing referral-based gamification to track actual
-- product usage. Points are awarded per-user based on their actions,
-- aggregated per-tenant for platform admin ranking.
--
-- New tables:
--   tenant_user_engagement  — per-user per-tenant point aggregation
--   tenant_usage_scores     — per-tenant adoption metrics (platform admin)
--
-- Extended:
--   gamification_points     — adds tenant_id column
--   gamification_point_weights — adds module usage actions
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Extend gamification_points with tenant_id ─────────────────
ALTER TABLE public.gamification_points
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gamification_points_tenant
  ON public.gamification_points(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── 2. Seed module usage point weights ───────────────────────────
INSERT INTO public.gamification_point_weights (action_key, action_label, points, description)
VALUES
  ('module_employee_added',       'Cadastrou Funcionário',        50,  'Novo funcionário registrado no sistema'),
  ('module_company_added',        'Cadastrou Empresa',            30,  'Nova empresa cadastrada'),
  ('module_department_added',     'Criou Departamento',           20,  'Novo departamento criado'),
  ('module_position_added',       'Criou Cargo',                  15,  'Novo cargo criado'),
  ('module_salary_contract',      'Criou Contrato Salarial',      60,  'Contrato salarial registrado'),
  ('module_ats_candidate',        'Adicionou Candidato',          35,  'Candidato adicionado ao processo seletivo'),
  ('module_performance_cycle',    'Criou Ciclo de Avaliação',     80,  'Ciclo de avaliação de desempenho criado'),
  ('module_automation_rule',      'Criou Regra de Automação',     70,  'Nova automação configurada'),
  ('module_visit',                'Acessou Módulo',                5,  'Módulo visitado (registrado pelo frontend)')
ON CONFLICT (action_key) DO NOTHING;

-- ── 3. tenant_user_engagement ─────────────────────────────────────
-- Aggregates points per user within a tenant.
-- Used by tenant admin to see team engagement leaderboard.
CREATE TABLE IF NOT EXISTS public.tenant_user_engagement (
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points   INTEGER NOT NULL DEFAULT 0,
  actions_count  INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  top_module     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE public.tenant_user_engagement ENABLE ROW LEVEL SECURITY;

-- Tenant admins see the full team leaderboard
CREATE POLICY "tenant_admin_read_engagement"
  ON public.tenant_user_engagement FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Users see their own record
CREATE POLICY "user_read_own_engagement"
  ON public.tenant_user_engagement FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Platform admins see all tenants
CREATE POLICY "platform_admin_read_engagement"
  ON public.tenant_user_engagement FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE INDEX idx_tenant_user_engagement_leaderboard
  ON public.tenant_user_engagement(tenant_id, total_points DESC);

CREATE INDEX idx_tenant_user_engagement_user
  ON public.tenant_user_engagement(user_id);

CREATE TRIGGER update_tenant_user_engagement_updated_at
  BEFORE UPDATE ON public.tenant_user_engagement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. tenant_usage_scores ────────────────────────────────────────
-- Aggregates module adoption per tenant.
-- Used by platform admin to rank clients by engagement.
CREATE TABLE IF NOT EXISTS public.tenant_usage_scores (
  tenant_id                UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  total_points             INTEGER NOT NULL DEFAULT 0,
  -- Module usage counters (incremented by triggers)
  employees_count          INTEGER NOT NULL DEFAULT 0,
  companies_count          INTEGER NOT NULL DEFAULT 0,
  departments_count        INTEGER NOT NULL DEFAULT 0,
  positions_count          INTEGER NOT NULL DEFAULT 0,
  salary_contracts_count   INTEGER NOT NULL DEFAULT 0,
  ats_candidates_count     INTEGER NOT NULL DEFAULT 0,
  performance_cycles_count INTEGER NOT NULL DEFAULT 0,
  automation_rules_count   INTEGER NOT NULL DEFAULT 0,
  -- Adoption metrics
  adoption_pct             NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0.0 to 1.0
  active_modules           TEXT[]  NOT NULL DEFAULT '{}',
  plan_modules_count       INTEGER NOT NULL DEFAULT 0,
  last_event_at            TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_usage_scores ENABLE ROW LEVEL SECURITY;

-- Tenant admins see their own score
CREATE POLICY "tenant_admin_read_own_score"
  ON public.tenant_usage_scores FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Platform admins see all (ranking)
CREATE POLICY "platform_admin_read_all_scores"
  ON public.tenant_usage_scores FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE INDEX idx_tenant_usage_scores_points
  ON public.tenant_usage_scores(total_points DESC);

CREATE INDEX idx_tenant_usage_scores_adoption
  ON public.tenant_usage_scores(adoption_pct DESC);
