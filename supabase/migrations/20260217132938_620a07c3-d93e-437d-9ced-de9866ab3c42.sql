
-- ReferralProgram entity
CREATE TABLE public.referral_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'credit' CHECK (reward_type IN ('credit', 'discount', 'points')),
  reward_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  conditions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_plan_tier TEXT,
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link referral_links to a program
ALTER TABLE public.referral_links
  ADD COLUMN program_id UUID REFERENCES public.referral_programs(id);

-- RLS
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_admin_referral_programs" ON public.referral_programs FOR ALL TO authenticated
  USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "users_read_active_programs" ON public.referral_programs FOR SELECT TO authenticated
  USING (is_active = true);

CREATE INDEX idx_referral_programs_active ON public.referral_programs(is_active);
CREATE INDEX idx_referral_links_program ON public.referral_links(program_id);
