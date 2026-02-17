
-- ═══════════════════════════════════════════════════════════════
-- Revenue Intelligence & Referral Engine — Database Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Referral Links
CREATE TABLE public.referral_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_signups INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_reward_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Referral Tracking
CREATE TABLE public.referral_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_link_id UUID NOT NULL REFERENCES public.referral_links(id),
  referrer_user_id UUID NOT NULL,
  referred_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  plan_id UUID REFERENCES public.saas_plans(id),
  first_payment_brl NUMERIC(12,2),
  reward_brl NUMERIC(12,2),
  reward_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Referral Rewards
CREATE TABLE public.referral_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  tracking_id UUID REFERENCES public.referral_tracking(id),
  reward_type TEXT NOT NULL DEFAULT 'commission',
  amount_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Gamification Points
CREATE TABLE public.gamification_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'referral',
  source_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Gamification Leaderboard
CREATE TABLE public.gamification_leaderboard (
  user_id UUID NOT NULL PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_reward_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_tier TEXT NOT NULL DEFAULT 'bronze',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_leaderboard ENABLE ROW LEVEL SECURITY;

-- Platform billing admins full access
CREATE POLICY "billing_admin_referral_links" ON public.referral_links FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_referral_tracking" ON public.referral_tracking FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_referral_rewards" ON public.referral_rewards FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_gamification_points" ON public.gamification_points FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "billing_admin_gamification_leaderboard" ON public.gamification_leaderboard FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

-- Users can view their own data
CREATE POLICY "users_own_referral_links" ON public.referral_links FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "users_own_referral_tracking" ON public.referral_tracking FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "users_own_referral_rewards" ON public.referral_rewards FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "users_own_gamification_points" ON public.gamification_points FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Leaderboard public read
CREATE POLICY "leaderboard_public_read" ON public.gamification_leaderboard FOR SELECT TO authenticated
  USING (true);

-- Indexes
CREATE INDEX idx_referral_links_referrer ON public.referral_links(referrer_user_id);
CREATE INDEX idx_referral_links_code ON public.referral_links(code);
CREATE INDEX idx_referral_tracking_referrer ON public.referral_tracking(referrer_user_id);
CREATE INDEX idx_referral_tracking_status ON public.referral_tracking(status);
CREATE INDEX idx_referral_rewards_user ON public.referral_rewards(referrer_user_id);
CREATE INDEX idx_gamification_points_user ON public.gamification_points(user_id);
