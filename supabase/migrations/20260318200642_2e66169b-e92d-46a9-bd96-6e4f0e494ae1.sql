-- ==========================================================
-- Talent Intelligence Hub - Modelagem de banco de dados
-- PostgreSQL | Multi-tenant | JSONB | LGPD | Produção
-- ==========================================================
-- Observações de arquitetura:
-- 1) Todas as tabelas possuem tenant_id para isolamento multi-tenant.
-- 2) CPF nunca é armazenado em texto puro: apenas cpf_hash.
-- 3) Responsáveis/usuários são UUIDs sem FK em auth.users para evitar acoplamento.
-- 4) Integridade entre tabelas filhas e pais é reforçada com FKs compostas (tenant_id, id).
-- 5) Soft delete padronizado com deleted_at.
-- 6) updated_at é mantido automaticamente por trigger.
-- 7) RLS usa a função existente public.is_tenant_member(auth.uid(), tenant_id).

-- ==========================================================
-- ENUMS
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_document_type') THEN
    CREATE TYPE public.candidate_document_type AS ENUM (
      'curriculo',
      'certificado',
      'outros'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_origin_type') THEN
    CREATE TYPE public.candidate_origin_type AS ENUM (
      'site',
      'linkedin',
      'importacao',
      'indicacao',
      'manual',
      'outro'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_status_type') THEN
    CREATE TYPE public.pipeline_status_type AS ENUM (
      'novo',
      'triagem',
      'entrevista',
      'proposta',
      'contratado',
      'rejeitado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrichment_source_type') THEN
    CREATE TYPE public.enrichment_source_type AS ENUM (
      'receita_federal',
      'justica',
      'serasa',
      'social'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status_type') THEN
    CREATE TYPE public.job_status_type AS ENUM (
      'draft',
      'open',
      'paused',
      'closed',
      'cancelled'
    );
  END IF;
END$$;

-- ==========================================================
-- FUNÇÕES AUXILIARES
-- ==========================================================
CREATE OR REPLACE FUNCTION public.talent_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.talent_soft_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Impede deleção física e converte a operação em soft delete.
  EXECUTE format('UPDATE %I.%I SET deleted_at = now(), updated_at = now() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME)
  USING OLD.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.talent_prevent_cross_tenant_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Garante consistência lógica quando existir candidate_id / job_id na mesma linha.
  IF TG_TABLE_NAME = 'candidate_pipeline' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_pipeline: candidate_id não pertence ao tenant informado';
    END IF;

    IF NEW.job_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = NEW.job_id
        AND j.tenant_id = NEW.tenant_id
        AND j.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_pipeline: job_id não pertence ao tenant informado';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'candidate_documents' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_documents: candidate_id não pertence ao tenant informado';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'candidate_enrichment' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_enrichment: candidate_id não pertence ao tenant informado';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'candidate_scores' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_scores: candidate_id não pertence ao tenant informado';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'candidate_logs' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'candidate_logs: candidate_id não pertence ao tenant informado';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'consent_logs' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE c.id = NEW.candidate_id
        AND c.tenant_id = NEW.tenant_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'consent_logs: candidate_id não pertence ao tenant informado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================
-- TABELAS PRINCIPAIS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  cpf_hash text NOT NULL,
  data_nascimento date,
  cidade text,
  estado text,
  consentimento_lgpd boolean NOT NULL DEFAULT false,
  consentimento_data timestamptz,
  origem public.candidate_origin_type NOT NULL DEFAULT 'manual',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidates_email_check CHECK (position('@' in email) > 1),
  CONSTRAINT candidates_estado_check CHECK (estado IS NULL OR char_length(estado) IN (2, 3)),
  CONSTRAINT candidates_consent_check CHECK (
    (consentimento_lgpd = false AND consentimento_data IS NULL)
    OR (consentimento_lgpd = true AND consentimento_data IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  tipo public.candidate_document_type NOT NULL,
  url_arquivo text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidate_documents_url_check CHECK (char_length(url_arquivo) > 0)
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  requisitos jsonb NOT NULL DEFAULT '[]'::jsonb,
  salario numeric(14,2),
  status public.job_status_type NOT NULL DEFAULT 'draft',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT jobs_salario_check CHECK (salario IS NULL OR salario >= 0),
  CONSTRAINT jobs_requisitos_array_check CHECK (jsonb_typeof(requisitos) = 'array')
);

CREATE TABLE IF NOT EXISTS public.candidate_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  job_id uuid,
  status public.pipeline_status_type NOT NULL DEFAULT 'novo',
  score numeric(6,2) NOT NULL DEFAULT 0,
  responsavel_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidate_pipeline_score_check CHECK (score >= 0 AND score <= 1000)
);

CREATE TABLE IF NOT EXISTS public.candidate_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  fonte public.enrichment_source_type NOT NULL,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_risco numeric(6,2) NOT NULL DEFAULT 0,
  data_consulta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidate_enrichment_score_risco_check CHECK (score_risco >= 0 AND score_risco <= 1000),
  CONSTRAINT candidate_enrichment_dados_json_check CHECK (jsonb_typeof(dados_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.candidate_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  score_total numeric(6,2) NOT NULL DEFAULT 0,
  score_tecnico numeric(6,2) NOT NULL DEFAULT 0,
  score_comportamental numeric(6,2) NOT NULL DEFAULT 0,
  score_risco numeric(6,2) NOT NULL DEFAULT 0,
  detalhes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidate_scores_total_check CHECK (score_total >= 0 AND score_total <= 1000),
  CONSTRAINT candidate_scores_tecnico_check CHECK (score_tecnico >= 0 AND score_tecnico <= 1000),
  CONSTRAINT candidate_scores_comportamental_check CHECK (score_comportamental >= 0 AND score_comportamental <= 1000),
  CONSTRAINT candidate_scores_risco_check CHECK (score_risco >= 0 AND score_risco <= 1000),
  CONSTRAINT candidate_scores_detalhes_json_check CHECK (jsonb_typeof(detalhes_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.candidate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  acao text NOT NULL,
  usuario_id uuid,
  descricao text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT candidate_logs_acao_check CHECK (char_length(trim(acao)) > 0)
);

CREATE TABLE IF NOT EXISTS public.consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  termo_versao text NOT NULL,
  ip text,
  user_agent text,
  data_consentimento timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT consent_logs_termo_versao_check CHECK (char_length(trim(termo_versao)) > 0)
);

-- ==========================================================
-- CHAVES ÚNICAS AUXILIARES PARA FKs COMPOSTAS (tenant_id, id)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_tenant_id_id_key'
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_tenant_id_id_key UNIQUE (tenant_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_tenant_id_id_key'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_tenant_id_id_key UNIQUE (tenant_id, id);
  END IF;
END$$;

-- ==========================================================
-- FOREIGN KEYS COMPOSTAS PARA EVITAR VÍNCULO ENTRE TENANTS
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_documents_candidate_fk'
  ) THEN
    ALTER TABLE public.candidate_documents
      ADD CONSTRAINT candidate_documents_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_pipeline_candidate_fk'
  ) THEN
    ALTER TABLE public.candidate_pipeline
      ADD CONSTRAINT candidate_pipeline_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_pipeline_job_fk'
  ) THEN
    ALTER TABLE public.candidate_pipeline
      ADD CONSTRAINT candidate_pipeline_job_fk
      FOREIGN KEY (tenant_id, job_id)
      REFERENCES public.jobs(tenant_id, id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_enrichment_candidate_fk'
  ) THEN
    ALTER TABLE public.candidate_enrichment
      ADD CONSTRAINT candidate_enrichment_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_scores_candidate_fk'
  ) THEN
    ALTER TABLE public.candidate_scores
      ADD CONSTRAINT candidate_scores_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_logs_candidate_fk'
  ) THEN
    ALTER TABLE public.candidate_logs
      ADD CONSTRAINT candidate_logs_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consent_logs_candidate_fk'
  ) THEN
    ALTER TABLE public.consent_logs
      ADD CONSTRAINT consent_logs_candidate_fk
      FOREIGN KEY (tenant_id, candidate_id)
      REFERENCES public.candidates(tenant_id, id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- ==========================================================
-- REGRAS DE NEGÓCIO / INTEGRIDADE
-- ==========================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_tenant_email_active
  ON public.candidates (tenant_id, lower(email))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_tenant_cpf_hash_active
  ON public.candidates (tenant_id, cpf_hash)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_pipeline_active_per_job
  ON public.candidate_pipeline (tenant_id, candidate_id, job_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_candidate_enrichment_active_source
  ON public.candidate_enrichment (tenant_id, candidate_id, fonte)
  WHERE deleted_at IS NULL;

-- ==========================================================
-- ÍNDICES DE PERFORMANCE
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_id ON public.candidates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_created_at ON public.candidates (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_email ON public.candidates (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_cpf_hash ON public.candidates (tenant_id, cpf_hash);
CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON public.candidates (deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_metadata_gin ON public.candidates USING GIN (metadata_json);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_tenant_id ON public.candidate_documents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate_id ON public.candidate_documents (tenant_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_metadata_gin ON public.candidate_documents USING GIN (metadata_json);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_deleted_at ON public.candidate_documents (deleted_at);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON public.jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON public.jobs (deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_requisitos_gin ON public.jobs USING GIN (requisitos);
CREATE INDEX IF NOT EXISTS idx_jobs_metadata_gin ON public.jobs USING GIN (metadata_json);

CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_tenant_id ON public.candidate_pipeline (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_status ON public.candidate_pipeline (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_candidate_id ON public.candidate_pipeline (tenant_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_job_id ON public.candidate_pipeline (tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_deleted_at ON public.candidate_pipeline (deleted_at);

CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_tenant_id ON public.candidate_enrichment (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_candidate_id ON public.candidate_enrichment (tenant_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_source ON public.candidate_enrichment (tenant_id, fonte, data_consulta DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_dados_gin ON public.candidate_enrichment USING GIN (dados_json);
CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_deleted_at ON public.candidate_enrichment (deleted_at);

CREATE INDEX IF NOT EXISTS idx_candidate_scores_tenant_id ON public.candidate_scores (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_scores_candidate_id ON public.candidate_scores (tenant_id, candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_scores_detalhes_gin ON public.candidate_scores USING GIN (detalhes_json);
CREATE INDEX IF NOT EXISTS idx_candidate_scores_deleted_at ON public.candidate_scores (deleted_at);

CREATE INDEX IF NOT EXISTS idx_candidate_logs_tenant_id ON public.candidate_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_logs_candidate_id ON public.candidate_logs (tenant_id, candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_logs_metadata_gin ON public.candidate_logs USING GIN (metadata_json);
CREATE INDEX IF NOT EXISTS idx_candidate_logs_deleted_at ON public.candidate_logs (deleted_at);

CREATE INDEX IF NOT EXISTS idx_consent_logs_tenant_id ON public.consent_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_candidate_id ON public.consent_logs (tenant_id, candidate_id, data_consentimento DESC);
CREATE INDEX IF NOT EXISTS idx_consent_logs_deleted_at ON public.consent_logs (deleted_at);

-- ==========================================================
-- ROW LEVEL SECURITY
-- ==========================================================
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation candidates" ON public.candidates;
CREATE POLICY "Tenant isolation candidates"
ON public.candidates
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation candidate_documents" ON public.candidate_documents;
CREATE POLICY "Tenant isolation candidate_documents"
ON public.candidate_documents
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation candidate_pipeline" ON public.candidate_pipeline;
CREATE POLICY "Tenant isolation candidate_pipeline"
ON public.candidate_pipeline
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation candidate_enrichment" ON public.candidate_enrichment;
CREATE POLICY "Tenant isolation candidate_enrichment"
ON public.candidate_enrichment
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation candidate_scores" ON public.candidate_scores;
CREATE POLICY "Tenant isolation candidate_scores"
ON public.candidate_scores
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation candidate_logs" ON public.candidate_logs;
CREATE POLICY "Tenant isolation candidate_logs"
ON public.candidate_logs
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation consent_logs" ON public.consent_logs;
CREATE POLICY "Tenant isolation consent_logs"
ON public.consent_logs
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant isolation jobs" ON public.jobs;
CREATE POLICY "Tenant isolation jobs"
ON public.jobs
FOR ALL
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) AND deleted_at IS NULL)
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ==========================================================
-- TRIGGERS DE AUDITORIA / SOFT DELETE / INTEGRIDADE
-- ==========================================================
DROP TRIGGER IF EXISTS trg_candidates_updated_at ON public.candidates;
CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_documents_updated_at ON public.candidate_documents;
CREATE TRIGGER trg_candidate_documents_updated_at
BEFORE UPDATE ON public.candidate_documents
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_pipeline_updated_at ON public.candidate_pipeline;
CREATE TRIGGER trg_candidate_pipeline_updated_at
BEFORE UPDATE ON public.candidate_pipeline
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_enrichment_updated_at ON public.candidate_enrichment;
CREATE TRIGGER trg_candidate_enrichment_updated_at
BEFORE UPDATE ON public.candidate_enrichment
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_scores_updated_at ON public.candidate_scores;
CREATE TRIGGER trg_candidate_scores_updated_at
BEFORE UPDATE ON public.candidate_scores
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_logs_updated_at ON public.candidate_logs;
CREATE TRIGGER trg_candidate_logs_updated_at
BEFORE UPDATE ON public.candidate_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_consent_logs_updated_at ON public.consent_logs;
CREATE TRIGGER trg_consent_logs_updated_at
BEFORE UPDATE ON public.consent_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_documents_soft_delete ON public.candidate_documents;
CREATE TRIGGER trg_candidate_documents_soft_delete
BEFORE DELETE ON public.candidate_documents
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidates_soft_delete ON public.candidates;
CREATE TRIGGER trg_candidates_soft_delete
BEFORE DELETE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_jobs_soft_delete ON public.jobs;
CREATE TRIGGER trg_jobs_soft_delete
BEFORE DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidate_pipeline_soft_delete ON public.candidate_pipeline;
CREATE TRIGGER trg_candidate_pipeline_soft_delete
BEFORE DELETE ON public.candidate_pipeline
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidate_enrichment_soft_delete ON public.candidate_enrichment;
CREATE TRIGGER trg_candidate_enrichment_soft_delete
BEFORE DELETE ON public.candidate_enrichment
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidate_scores_soft_delete ON public.candidate_scores;
CREATE TRIGGER trg_candidate_scores_soft_delete
BEFORE DELETE ON public.candidate_scores
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidate_logs_soft_delete ON public.candidate_logs;
CREATE TRIGGER trg_candidate_logs_soft_delete
BEFORE DELETE ON public.candidate_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_consent_logs_soft_delete ON public.consent_logs;
CREATE TRIGGER trg_consent_logs_soft_delete
BEFORE DELETE ON public.consent_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_soft_delete_guard();

DROP TRIGGER IF EXISTS trg_candidate_documents_cross_tenant ON public.candidate_documents;
CREATE TRIGGER trg_candidate_documents_cross_tenant
BEFORE INSERT OR UPDATE ON public.candidate_documents
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

DROP TRIGGER IF EXISTS trg_candidate_pipeline_cross_tenant ON public.candidate_pipeline;
CREATE TRIGGER trg_candidate_pipeline_cross_tenant
BEFORE INSERT OR UPDATE ON public.candidate_pipeline
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

DROP TRIGGER IF EXISTS trg_candidate_enrichment_cross_tenant ON public.candidate_enrichment;
CREATE TRIGGER trg_candidate_enrichment_cross_tenant
BEFORE INSERT OR UPDATE ON public.candidate_enrichment
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

DROP TRIGGER IF EXISTS trg_candidate_scores_cross_tenant ON public.candidate_scores;
CREATE TRIGGER trg_candidate_scores_cross_tenant
BEFORE INSERT OR UPDATE ON public.candidate_scores
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

DROP TRIGGER IF EXISTS trg_candidate_logs_cross_tenant ON public.candidate_logs;
CREATE TRIGGER trg_candidate_logs_cross_tenant
BEFORE INSERT OR UPDATE ON public.candidate_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

DROP TRIGGER IF EXISTS trg_consent_logs_cross_tenant ON public.consent_logs;
CREATE TRIGGER trg_consent_logs_cross_tenant
BEFORE INSERT OR UPDATE ON public.consent_logs
FOR EACH ROW EXECUTE FUNCTION public.talent_prevent_cross_tenant_reference();

-- ==========================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ==========================================================
COMMENT ON TABLE public.candidates IS 'Cadastro principal de candidatos do Talent Intelligence Hub. Armazena somente cpf_hash, nunca CPF puro.';
COMMENT ON TABLE public.candidate_documents IS 'Documentos anexados do candidato com metadados em JSONB.';
COMMENT ON TABLE public.candidate_pipeline IS 'Andamento do candidato por vaga no pipeline ATS.';
COMMENT ON TABLE public.candidate_enrichment IS 'Dados enriquecidos vindos de fontes externas em JSONB.';
COMMENT ON TABLE public.candidate_scores IS 'Pontuações consolidadas do candidato com detalhamento em JSONB.';
COMMENT ON TABLE public.candidate_logs IS 'Trilha de auditoria operacional por candidato.';
COMMENT ON TABLE public.consent_logs IS 'Histórico de consentimento LGPD do candidato.';
COMMENT ON TABLE public.jobs IS 'Vagas do tenant para uso no pipeline do Talent Hub.';

COMMENT ON COLUMN public.candidates.cpf_hash IS 'Hash irreversível do CPF para deduplicação e conformidade LGPD.';
COMMENT ON COLUMN public.candidate_enrichment.dados_json IS 'Payload estruturado de enriquecimento, indexado via GIN.';
COMMENT ON COLUMN public.candidate_scores.detalhes_json IS 'Breakdown do score por critérios, pesos e evidências.';