
-- Enum for platform-level roles
CREATE TYPE public.platform_role AS ENUM ('platform_super_admin', 'platform_support', 'platform_finance');

-- Platform users table — NO tenant_id
CREATE TABLE public.platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role public.platform_role NOT NULL DEFAULT 'platform_support',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check platform role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id UUID, _role public.platform_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = _user_id AND role = _role AND status = 'active'
  );
$$;

-- Only platform_super_admin can read/manage platform_users
CREATE POLICY "Platform super admins can select all platform users"
  ON public.platform_users FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform super admins can insert platform users"
  ON public.platform_users FOR INSERT TO authenticated
  WITH CHECK (public.has_platform_role(auth.uid(), 'platform_super_admin'));

CREATE POLICY "Platform super admins can update platform users"
  ON public.platform_users FOR UPDATE TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_super_admin'));

CREATE POLICY "Platform super admins can delete platform users"
  ON public.platform_users FOR DELETE TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_platform_users_updated_at
  BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_platform_users_user_id ON public.platform_users(user_id);
CREATE INDEX idx_platform_users_role ON public.platform_users(role);
