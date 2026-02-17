
-- Gamification Levels (configurable)
CREATE TABLE public.gamification_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  min_points INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#CD7F32',
  icon TEXT DEFAULT NULL,
  badge_label TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_levels" ON public.gamification_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_levels" ON public.gamification_levels FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);

INSERT INTO public.gamification_levels (name, slug, min_points, color, sort_order) VALUES
  ('Bronze', 'bronze', 0, '#CD7F32', 1),
  ('Silver', 'silver', 500, '#C0C0C0', 2),
  ('Gold', 'gold', 2000, '#FFD700', 3),
  ('Platinum', 'platinum', 5000, '#E5E4E2', 4);

-- Point Weights (configurable scoring)
CREATE TABLE public.gamification_point_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_key TEXT NOT NULL UNIQUE,
  action_label TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_point_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_weights" ON public.gamification_point_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_weights" ON public.gamification_point_weights FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);

INSERT INTO public.gamification_point_weights (action_key, action_label, points, description) VALUES
  ('referral_signup', 'Indicação - Signup', 100, 'Quando o indicado cria uma conta'),
  ('referral_conversion', 'Indicação - Conversão', 500, 'Quando o indicado ativa um plano pago'),
  ('referral_upgrade', 'Indicado fez Upgrade', 300, 'Quando o indicado faz upgrade de plano'),
  ('referral_retention_month', 'Retenção do Indicado (mês)', 50, 'Pontos por cada mês que o indicado permanece ativo');

-- Gamification Profiles (owner with badges)
CREATE TABLE public.gamification_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  level_id UUID REFERENCES public.gamification_levels(id),
  badges TEXT[] NOT NULL DEFAULT '{}',
  streak_months INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_all_profiles" ON public.gamification_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_profile" ON public.gamification_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_own_profile" ON public.gamification_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin_manage_profiles" ON public.gamification_profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);
