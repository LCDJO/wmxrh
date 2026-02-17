
-- 1. Add Growth/Marketing permission definitions
INSERT INTO public.platform_permission_definitions (code, module, description, resource, action) VALUES
  ('growth.view',         'growth', 'Visualizar módulo Growth AI e Website', 'growth', 'view'),
  ('growth.create',       'growth', 'Criar landing pages, FAB content, campanhas', 'growth', 'create'),
  ('growth.edit',         'growth', 'Editar conteúdo existente do módulo Growth', 'growth', 'edit'),
  ('growth.submit',       'growth', 'Submeter conteúdo para aprovação', 'growth', 'submit'),
  ('growth.approve',      'growth', 'Aprovar ou rejeitar submissões de conteúdo', 'growth', 'approve'),
  ('growth.publish',      'growth', 'Publicar conteúdo aprovado no site/landing', 'growth', 'publish'),
  ('growth.delete',       'growth', 'Excluir conteúdo do módulo Growth', 'growth', 'delete'),
  ('growth.version_view', 'growth', 'Visualizar histórico de versões', 'growth', 'version_view')
ON CONFLICT (code) DO NOTHING;

-- 2. Add platform_roles entries
INSERT INTO public.platform_roles (name, slug, description, is_system_role) VALUES
  ('Equipe de Marketing', 'platform_marketing_team', 'Criação e edição de conteúdo Growth/Website. Submissões requerem aprovação do Diretor.', true),
  ('Diretor de Marketing', 'platform_marketing_director', 'Aprovação de publicações, landing pages e conteúdo Growth. Duplo aceite obrigatório.', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Assign permissions to marketing_team
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_marketing_team'::platform_role
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_marketing_team'
  AND p.code IN ('growth.view','growth.create','growth.edit','growth.submit','growth.version_view')
ON CONFLICT DO NOTHING;

-- 4. Assign permissions to marketing_director
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_marketing_director'::platform_role
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_marketing_director'
  AND p.code IN ('growth.view','growth.create','growth.edit','growth.submit','growth.approve','growth.publish','growth.delete','growth.version_view')
ON CONFLICT DO NOTHING;

-- 5. Assign growth permissions to super_admin
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_super_admin'::platform_role
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_super_admin'
  AND p.code LIKE 'growth.%'
ON CONFLICT DO NOTHING;

-- 6. Global access scopes
INSERT INTO public.platform_access_scopes (role_id, scope_type)
SELECT id, 'global' FROM public.platform_roles WHERE slug = 'platform_marketing_team'
AND NOT EXISTS (SELECT 1 FROM public.platform_access_scopes WHERE role_id = (SELECT id FROM public.platform_roles WHERE slug = 'platform_marketing_team'));

INSERT INTO public.platform_access_scopes (role_id, scope_type)
SELECT id, 'global' FROM public.platform_roles WHERE slug = 'platform_marketing_director'
AND NOT EXISTS (SELECT 1 FROM public.platform_access_scopes WHERE role_id = (SELECT id FROM public.platform_roles WHERE slug = 'platform_marketing_director'));

-- 7. Growth Submissions table
CREATE TABLE public.growth_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('landing_page', 'fab_content', 'website_page', 'campaign', 'template')),
  content_id TEXT NOT NULL,
  content_title TEXT NOT NULL,
  content_snapshot JSONB NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  change_summary TEXT,
  diff_from_previous JSONB,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_by_email TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'cancelled')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_by_email TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  publish_approved_by UUID REFERENCES auth.users(id),
  publish_approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view growth submissions"
  ON public.growth_submissions FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can create submissions"
  ON public.growth_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update submissions"
  ON public.growth_submissions FOR UPDATE TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE TRIGGER update_growth_submissions_updated_at
  BEFORE UPDATE ON public.growth_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Growth submission audit log
CREATE TABLE public.growth_submission_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.growth_submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'published', 'cancelled', 'resubmitted', 'version_created')),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_by_email TEXT NOT NULL,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_submission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view submission logs"
  ON public.growth_submission_logs FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert submission logs"
  ON public.growth_submission_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_platform_user(auth.uid()));
