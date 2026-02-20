
-- Legal Document Versioning — immutable append-only
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('lei', 'decreto', 'portaria', 'instrucao_normativa', 'nr', 'clt', 'convencao', 'acordo_coletivo', 'resolucao', 'medida_provisoria', 'outro')),
  codigo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  ementa TEXT,
  conteudo_texto TEXT,
  data_publicacao DATE NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  hash_conteudo TEXT NOT NULL,
  fonte TEXT,
  url_original TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  substituida_por UUID REFERENCES public.legal_documents(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (tenant_id, codigo, versao)
);

-- When a new version is inserted as current, mark previous versions as not current
CREATE OR REPLACE FUNCTION public.fn_legal_doc_ensure_single_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.legal_documents
    SET is_current = false, substituida_por = NEW.id
    WHERE tenant_id = NEW.tenant_id
      AND codigo = NEW.codigo
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_legal_doc_single_current
BEFORE INSERT ON public.legal_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_legal_doc_ensure_single_current();

-- Immutability: block updates and deletes
CREATE OR REPLACE FUNCTION public.fn_legal_doc_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Legal documents are immutable and cannot be deleted.';
  END IF;
  -- Allow only is_current and substituida_por updates (done by trigger)
  IF OLD.hash_conteudo IS DISTINCT FROM NEW.hash_conteudo
    OR OLD.conteudo_texto IS DISTINCT FROM NEW.conteudo_texto
    OR OLD.codigo IS DISTINCT FROM NEW.codigo
    OR OLD.versao IS DISTINCT FROM NEW.versao
    OR OLD.data_publicacao IS DISTINCT FROM NEW.data_publicacao
  THEN
    RAISE EXCEPTION 'Legal document content is immutable. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_legal_doc_immutable_update
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_legal_doc_immutable();

CREATE TRIGGER trg_legal_doc_immutable_delete
BEFORE DELETE ON public.legal_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_legal_doc_immutable();

-- RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view legal documents"
ON public.legal_documents FOR SELECT
USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert legal documents"
ON public.legal_documents FOR INSERT
WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Index for fast lookups
CREATE INDEX idx_legal_documents_tenant_codigo ON public.legal_documents(tenant_id, codigo);
CREATE INDEX idx_legal_documents_current ON public.legal_documents(tenant_id, is_current) WHERE is_current = true;
CREATE INDEX idx_legal_documents_vigencia ON public.legal_documents(vigencia_inicio, vigencia_fim);
