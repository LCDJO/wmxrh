
-- ═══════════════════════════════════════════════════════
-- Document Validation & LGPD Compliance Engine
-- ═══════════════════════════════════════════════════════

-- 1. Validation tokens — one per signed document
CREATE TABLE public.document_validation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  document_vault_id UUID NOT NULL,
  agreement_id UUID,
  employee_id UUID,
  company_id UUID,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  document_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dvt_token ON public.document_validation_tokens(token);
CREATE INDEX idx_dvt_tenant ON public.document_validation_tokens(tenant_id);
CREATE INDEX idx_dvt_vault ON public.document_validation_tokens(document_vault_id);

ALTER TABLE public.document_validation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view validation tokens"
  ON public.document_validation_tokens FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can create validation tokens"
  ON public.document_validation_tokens FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can revoke validation tokens"
  ON public.document_validation_tokens FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  );

-- 2. LGPD access logs — every public validation attempt
CREATE TABLE public.document_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.document_validation_tokens(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  requester_name TEXT,
  requester_document TEXT,
  requester_purpose TEXT,
  access_result TEXT NOT NULL DEFAULT 'success' CHECK (access_result IN ('success', 'invalid_token', 'expired', 'revoked', 'hash_mismatch')),
  metadata JSONB
);

CREATE INDEX idx_dal_token ON public.document_access_logs(token_id);
CREATE INDEX idx_dal_tenant ON public.document_access_logs(tenant_id);
CREATE INDEX idx_dal_accessed ON public.document_access_logs(accessed_at);

ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view access logs"
  ON public.document_access_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  );

-- Edge function inserts logs without auth (public validation)
CREATE POLICY "Service role can insert access logs"
  ON public.document_access_logs FOR INSERT
  WITH CHECK (true);
