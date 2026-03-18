-- Talent Intelligence Hub foundation for multi-tenant HR SaaS
-- Creates public capture, ATS enrichment, scoring, AI dossier, consent and audit infrastructure

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_submission_status') THEN
    CREATE TYPE public.talent_submission_status AS ENUM ('received', 'processing', 'qualified', 'rejected', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_job_type') THEN
    CREATE TYPE public.talent_job_type AS ENUM ('cv_parse', 'enrichment', 'scoring', 'dossier');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_job_status') THEN
    CREATE TYPE public.talent_job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_enrichment_provider') THEN
    CREATE TYPE public.talent_enrichment_provider AS ENUM ('receita_federal', 'tst', 'cnj', 'ceis', 'trabalho_escravo', 'custom');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_consent_source') THEN
    CREATE TYPE public.talent_consent_source AS ENUM ('public_landing', 'internal_import', 'manual_admin');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.talent_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.talent_block_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table cannot be modified';
END;
$$;

CREATE TABLE IF NOT EXISTS public.talent_public_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  headline text,
  subheadline text,
  description text,
  hero_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_version text NOT NULL DEFAULT 'v1',
  consent_text text NOT NULL,
  success_message text,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.talent_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  public_page_id uuid REFERENCES public.talent_public_pages(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  cpf text,
  email text NOT NULL,
  phone text,
  linkedin_url text,
  city text,
  state text,
  resume_storage_path text,
  resume_file_name text,
  source text NOT NULL DEFAULT 'landing_page',
  status public.talent_submission_status NOT NULL DEFAULT 'received',
  raw_form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_cv jsonb NOT NULL DEFAULT '{}'::jsonb,
  ats_candidate_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL UNIQUE REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  intake_submission_id uuid REFERENCES public.talent_intake_submissions(id) ON DELETE SET NULL,
  internal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_cv jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  search_keywords text[] NOT NULL DEFAULT '{}'::text[],
  current_score numeric(6,2),
  dossier_status text NOT NULL DEFAULT 'pending',
  enrichment_status text NOT NULL DEFAULT 'pending',
  last_enriched_at timestamptz,
  ai_summary text,
  ai_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  intake_submission_id uuid REFERENCES public.talent_intake_submissions(id) ON DELETE CASCADE,
  public_page_id uuid REFERENCES public.talent_public_pages(id) ON DELETE SET NULL,
  consent_source public.talent_consent_source NOT NULL,
  consent_version text NOT NULL,
  consent_text_snapshot text NOT NULL,
  consent_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  consented boolean NOT NULL DEFAULT true,
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  provider public.talent_enrichment_provider NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, provider)
);

CREATE TABLE IF NOT EXISTS public.talent_scoring_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  model_id uuid REFERENCES public.talent_scoring_models(id) ON DELETE SET NULL,
  total_score numeric(6,2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL UNIQUE REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  dossier jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_file_path text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_candidate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  intake_submission_id uuid REFERENCES public.talent_intake_submissions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  intake_submission_id uuid REFERENCES public.talent_intake_submissions(id) ON DELETE CASCADE,
  provider public.talent_enrichment_provider,
  job_type public.talent_job_type NOT NULL,
  status public.talent_job_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_candidates
  ADD COLUMN IF NOT EXISTS public_page_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS pipeline_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_storage_path text,
  ADD COLUMN IF NOT EXISTS current_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

ALTER TABLE public.ats_requisitions
  ADD COLUMN IF NOT EXISTS is_talent_pool boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intake_page_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_talent_public_pages_tenant_active ON public.talent_public_pages (tenant_id, is_active, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_intake_submissions_tenant_status ON public.talent_intake_submissions (tenant_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_intake_submissions_page ON public.talent_intake_submissions (public_page_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_profiles_tenant ON public.talent_candidate_profiles (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_profiles_tags ON public.talent_candidate_profiles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_profiles_keywords ON public.talent_candidate_profiles USING GIN (search_keywords);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_consents_candidate ON public.talent_candidate_consents (tenant_id, candidate_id, consented_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_enrichments_candidate_provider ON public.talent_candidate_enrichments (candidate_id, provider);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_scores_candidate ON public.talent_candidate_scores (tenant_id, candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_candidate_events_candidate ON public.talent_candidate_events (tenant_id, candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_enrichment_jobs_status ON public.talent_enrichment_jobs (tenant_id, status, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_ats_candidates_tags ON public.ats_candidates USING GIN (tags);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ats_candidates_public_page_id_fkey'
  ) THEN
    ALTER TABLE public.ats_candidates
      ADD CONSTRAINT ats_candidates_public_page_id_fkey
      FOREIGN KEY (public_page_id)
      REFERENCES public.talent_public_pages(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ats_requisitions_intake_page_id_fkey'
  ) THEN
    ALTER TABLE public.ats_requisitions
      ADD CONSTRAINT ats_requisitions_intake_page_id_fkey
      FOREIGN KEY (intake_page_id)
      REFERENCES public.talent_public_pages(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talent_intake_submissions_ats_candidate_id_fkey'
  ) THEN
    ALTER TABLE public.talent_intake_submissions
      ADD CONSTRAINT talent_intake_submissions_ats_candidate_id_fkey
      FOREIGN KEY (ats_candidate_id)
      REFERENCES public.ats_candidates(id)
      ON DELETE SET NULL;
  END IF;
END$$;

ALTER TABLE public.talent_public_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_scoring_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_candidate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_enrichment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage talent public pages" ON public.talent_public_pages;
CREATE POLICY "Tenant members can manage talent public pages"
ON public.talent_public_pages
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Public can view active talent public pages" ON public.talent_public_pages;
CREATE POLICY "Public can view active talent public pages"
ON public.talent_public_pages
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Tenant members can view intake submissions" ON public.talent_intake_submissions;
CREATE POLICY "Tenant members can view intake submissions"
ON public.talent_intake_submissions
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can manage intake submissions" ON public.talent_intake_submissions;
CREATE POLICY "Tenant members can manage intake submissions"
ON public.talent_intake_submissions
FOR UPDATE
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can delete intake submissions" ON public.talent_intake_submissions;
CREATE POLICY "Tenant members can delete intake submissions"
ON public.talent_intake_submissions
FOR DELETE
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Public can create intake submissions on active pages" ON public.talent_intake_submissions;
CREATE POLICY "Public can create intake submissions on active pages"
ON public.talent_intake_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.talent_public_pages tp
    WHERE tp.id = public_page_id
      AND tp.tenant_id = public.talent_intake_submissions.tenant_id
      AND tp.is_active = true
  )
);

DROP POLICY IF EXISTS "Tenant members can manage talent candidate profiles" ON public.talent_candidate_profiles;
CREATE POLICY "Tenant members can manage talent candidate profiles"
ON public.talent_candidate_profiles
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can view talent candidate consents" ON public.talent_candidate_consents;
CREATE POLICY "Tenant members can view talent candidate consents"
ON public.talent_candidate_consents
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Public can insert talent candidate consents" ON public.talent_candidate_consents;
CREATE POLICY "Public can insert talent candidate consents"
ON public.talent_candidate_consents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  consented = true
  AND EXISTS (
    SELECT 1
    FROM public.talent_public_pages tp
    WHERE tp.id = public_page_id
      AND tp.tenant_id = public.talent_candidate_consents.tenant_id
      AND tp.is_active = true
  )
);

DROP POLICY IF EXISTS "Tenant members can insert talent candidate consents" ON public.talent_candidate_consents;
CREATE POLICY "Tenant members can insert talent candidate consents"
ON public.talent_candidate_consents
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can manage talent enrichments" ON public.talent_candidate_enrichments;
CREATE POLICY "Tenant members can manage talent enrichments"
ON public.talent_candidate_enrichments
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can manage scoring models" ON public.talent_scoring_models;
CREATE POLICY "Tenant members can manage scoring models"
ON public.talent_scoring_models
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can view candidate scores" ON public.talent_candidate_scores;
CREATE POLICY "Tenant members can view candidate scores"
ON public.talent_candidate_scores
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can insert candidate scores" ON public.talent_candidate_scores;
CREATE POLICY "Tenant members can insert candidate scores"
ON public.talent_candidate_scores
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can manage candidate dossiers" ON public.talent_candidate_dossiers;
CREATE POLICY "Tenant members can manage candidate dossiers"
ON public.talent_candidate_dossiers
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can view candidate events" ON public.talent_candidate_events;
CREATE POLICY "Tenant members can view candidate events"
ON public.talent_candidate_events
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can insert candidate events" ON public.talent_candidate_events;
CREATE POLICY "Tenant members can insert candidate events"
ON public.talent_candidate_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Public can insert landing candidate events" ON public.talent_candidate_events;
CREATE POLICY "Public can insert landing candidate events"
ON public.talent_candidate_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  intake_submission_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.talent_intake_submissions tis
    LEFT JOIN public.talent_public_pages tp ON tp.id = tis.public_page_id
    WHERE tis.id = public.talent_candidate_events.intake_submission_id
      AND tis.tenant_id = public.talent_candidate_events.tenant_id
      AND tp.is_active = true
  )
);

DROP POLICY IF EXISTS "Tenant members can manage enrichment jobs" ON public.talent_enrichment_jobs;
CREATE POLICY "Tenant members can manage enrichment jobs"
ON public.talent_enrichment_jobs
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS trg_talent_public_pages_updated_at ON public.talent_public_pages;
CREATE TRIGGER trg_talent_public_pages_updated_at
BEFORE UPDATE ON public.talent_public_pages
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_intake_submissions_updated_at ON public.talent_intake_submissions;
CREATE TRIGGER trg_talent_intake_submissions_updated_at
BEFORE UPDATE ON public.talent_intake_submissions
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_candidate_profiles_updated_at ON public.talent_candidate_profiles;
CREATE TRIGGER trg_talent_candidate_profiles_updated_at
BEFORE UPDATE ON public.talent_candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_candidate_enrichments_updated_at ON public.talent_candidate_enrichments;
CREATE TRIGGER trg_talent_candidate_enrichments_updated_at
BEFORE UPDATE ON public.talent_candidate_enrichments
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_scoring_models_updated_at ON public.talent_scoring_models;
CREATE TRIGGER trg_talent_scoring_models_updated_at
BEFORE UPDATE ON public.talent_scoring_models
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_candidate_dossiers_updated_at ON public.talent_candidate_dossiers;
CREATE TRIGGER trg_talent_candidate_dossiers_updated_at
BEFORE UPDATE ON public.talent_candidate_dossiers
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_enrichment_jobs_updated_at ON public.talent_enrichment_jobs;
CREATE TRIGGER trg_talent_enrichment_jobs_updated_at
BEFORE UPDATE ON public.talent_enrichment_jobs
FOR EACH ROW EXECUTE FUNCTION public.talent_touch_updated_at();

DROP TRIGGER IF EXISTS trg_talent_candidate_consents_append_only_update ON public.talent_candidate_consents;
CREATE TRIGGER trg_talent_candidate_consents_append_only_update
BEFORE UPDATE OR DELETE ON public.talent_candidate_consents
FOR EACH ROW EXECUTE FUNCTION public.talent_block_append_only_mutation();

DROP TRIGGER IF EXISTS trg_talent_candidate_events_append_only_update ON public.talent_candidate_events;
CREATE TRIGGER trg_talent_candidate_events_append_only_update
BEFORE UPDATE OR DELETE ON public.talent_candidate_events
FOR EACH ROW EXECUTE FUNCTION public.talent_block_append_only_mutation();

INSERT INTO storage.buckets (id, name, public)
SELECT 'talent-resumes', 'talent-resumes', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'talent-resumes'
);

DROP POLICY IF EXISTS "Tenant members can view own talent resumes" ON storage.objects;
CREATE POLICY "Tenant members can view own talent resumes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'talent-resumes'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant members can upload own talent resumes" ON storage.objects;
CREATE POLICY "Tenant members can upload own talent resumes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'talent-resumes'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant members can update own talent resumes" ON storage.objects;
CREATE POLICY "Tenant members can update own talent resumes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'talent-resumes'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'talent-resumes'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant members can delete own talent resumes" ON storage.objects;
CREATE POLICY "Tenant members can delete own talent resumes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'talent-resumes'
  AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

INSERT INTO public.ats_pipeline_stages (tenant_id, stage_key, label, sort_order, is_terminal, is_active)
SELECT t.id, s.stage_key, s.label, s.sort_order, s.is_terminal, true
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('applied', 'Aplicado', 10, false),
    ('screening', 'Triagem', 20, false),
    ('interview', 'Entrevista', 30, false),
    ('offer', 'Proposta', 40, false),
    ('hired', 'Contratado', 50, true),
    ('rejected', 'Rejeitado', 60, true),
    ('withdrawn', 'Desistiu', 70, true)
) AS s(stage_key, label, sort_order, is_terminal)
ON CONFLICT (tenant_id, stage_key) DO NOTHING;