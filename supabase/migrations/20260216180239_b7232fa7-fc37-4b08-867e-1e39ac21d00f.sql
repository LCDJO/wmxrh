
-- Document Vault table
CREATE TABLE public.document_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  agreement_id UUID REFERENCES public.employee_agreements(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  nome_documento TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'termo',
  url_arquivo TEXT NOT NULL,
  assinatura_valida BOOLEAN NOT NULL DEFAULT false,
  hash_documento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_document_vault_employee ON public.document_vault(employee_id);
CREATE INDEX idx_document_vault_tenant ON public.document_vault(tenant_id);
CREATE INDEX idx_document_vault_tipo ON public.document_vault(tipo_documento);

-- RLS
ALTER TABLE public.document_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view documents"
  ON public.document_vault FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert documents"
  ON public.document_vault FOR INSERT
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update documents"
  ON public.document_vault FOR UPDATE
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete documents"
  ON public.document_vault FOR DELETE
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_document_vault_updated_at
  BEFORE UPDATE ON public.document_vault
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_document_vault
  AFTER INSERT OR UPDATE OR DELETE ON public.document_vault
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
