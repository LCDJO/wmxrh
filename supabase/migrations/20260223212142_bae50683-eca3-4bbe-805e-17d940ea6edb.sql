
-- ═══════════════════════════════════════════════════════
-- Signed Document Registry
-- ═══════════════════════════════════════════════════════

CREATE TABLE public.signed_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  agreement_template_id UUID,
  versao INTEGER NOT NULL DEFAULT 1,
  hash_sha256 TEXT NOT NULL,
  validation_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  documento_url TEXT NOT NULL,
  data_assinatura TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_assinatura TEXT,
  provider_signature_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  company_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sd_tenant ON public.signed_documents(tenant_id);
CREATE INDEX idx_sd_employee ON public.signed_documents(employee_id);
CREATE INDEX idx_sd_template ON public.signed_documents(agreement_template_id);
CREATE INDEX idx_sd_validation ON public.signed_documents(validation_token);
CREATE INDEX idx_sd_hash ON public.signed_documents(hash_sha256);

-- Immutability: block UPDATE on hash, documento_url, data_assinatura, ip_assinatura, validation_token, provider_signature_id, employee_id, agreement_template_id, versao
CREATE OR REPLACE FUNCTION public.prevent_signed_document_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
     OR OLD.documento_url IS DISTINCT FROM NEW.documento_url
     OR OLD.data_assinatura IS DISTINCT FROM NEW.data_assinatura
     OR OLD.ip_assinatura IS DISTINCT FROM NEW.ip_assinatura
     OR OLD.validation_token IS DISTINCT FROM NEW.validation_token
     OR OLD.provider_signature_id IS DISTINCT FROM NEW.provider_signature_id
     OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.agreement_template_id IS DISTINCT FROM NEW.agreement_template_id
     OR OLD.versao IS DISTINCT FROM NEW.versao
  THEN
    RAISE EXCEPTION 'Signed document fields are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_signed_document_mutation
  BEFORE UPDATE ON public.signed_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_document_mutation();

-- Block DELETE entirely
CREATE OR REPLACE FUNCTION public.prevent_signed_document_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Signed documents cannot be deleted (legal requirement)';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_signed_document_delete
  BEFORE DELETE ON public.signed_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_document_delete();

-- RLS
ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view signed documents"
  ON public.signed_documents FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert signed documents"
  ON public.signed_documents FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Only allow updating 'ativo' field (soft-deactivation)
CREATE POLICY "Admins can deactivate signed documents"
  ON public.signed_documents FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  );
