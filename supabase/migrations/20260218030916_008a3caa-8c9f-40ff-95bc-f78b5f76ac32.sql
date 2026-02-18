
-- ══ Support Squads ══
CREATE TABLE public.support_squads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  coordinator_agent_id UUID REFERENCES public.platform_users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Squad membership (agent ↔ squad)
CREATE TABLE public.support_squad_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.support_squads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (squad_id, agent_id)
);

-- RLS
ALTER TABLE public.support_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_squad_members ENABLE ROW LEVEL SECURITY;

-- Only active platform users can read squads
CREATE POLICY "Platform users can view squads"
  ON public.support_squads FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Only super_admin / support_manager can manage squads
CREATE POLICY "Managers can manage squads"
  ON public.support_squads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('platform_super_admin', 'platform_support_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('platform_super_admin', 'platform_support_manager')
    )
  );

-- Squad members: platform users can view
CREATE POLICY "Platform users can view squad members"
  ON public.support_squad_members FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Squad members: managers can manage
CREATE POLICY "Managers can manage squad members"
  ON public.support_squad_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('platform_super_admin', 'platform_support_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('platform_super_admin', 'platform_support_manager')
    )
  );

-- Timestamp trigger
CREATE TRIGGER update_support_squads_updated_at
  BEFORE UPDATE ON public.support_squads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if user is coordinator of a given squad
CREATE OR REPLACE FUNCTION public.is_squad_coordinator(_user_id uuid, _squad_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_squads s
    JOIN public.platform_users pu ON pu.id = s.coordinator_agent_id
    WHERE s.id = _squad_id
      AND pu.user_id = _user_id
      AND pu.status = 'active'
      AND s.is_active = true
  );
$$;

-- Helper: get all squad IDs for a coordinator
CREATE OR REPLACE FUNCTION public.get_coordinator_squad_ids(_user_id uuid)
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT s.id FROM public.support_squads s
  JOIN public.platform_users pu ON pu.id = s.coordinator_agent_id
  WHERE pu.user_id = _user_id
    AND pu.status = 'active'
    AND s.is_active = true;
$$;
