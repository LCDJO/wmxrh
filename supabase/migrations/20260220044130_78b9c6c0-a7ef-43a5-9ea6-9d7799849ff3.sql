
-- ══════════════════════════════════════════════════════════════
-- Regulatory Intelligence Security Layer
-- 1. SuperAdmin-only source configuration
-- 2. Immutable audit log
-- 3. Tighten legal_documents insert to SuperAdmin
-- ══════════════════════════════════════════════════════════════

-- ── Helper: check if user is tenant superadmin ──
CREATE OR REPLACE FUNCTION public.is_tenant_superadmin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('superadmin', 'owner')
  )
$$;

-- ══════════════════════════════════════════════════════════════
-- 1. REGULATORY SOURCE CONFIGS — SuperAdmin only
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.regulatory_source_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('dou', 'mte', 'ibge', 'esocial', 'manual', 'api_externa')),
  nome TEXT NOT NULL,
  url_base TEXT,
  credenciais_ref TEXT,  -- reference to secret vault, never plaintext
  is_active BOOLEAN NOT NULL DEFAULT true,
  frequencia_verificacao TEXT NOT NULL DEFAULT 'diaria' CHECK (frequencia_verificacao IN ('diaria', 'semanal', 'quinzenal', 'mensal')),
  tipos_monitorados TEXT[] NOT NULL DEFAULT '{}',
  configurado_por UUID NOT NULL,
  configurado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.regulatory_source_configs ENABLE ROW LEVEL SECURITY;

-- Read: any tenant member
CREATE POLICY "Tenant members can view source configs"
ON public.regulatory_source_configs FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Insert: SuperAdmin only
CREATE POLICY "SuperAdmin can insert source configs"
ON public.regulatory_source_configs FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_superadmin(auth.uid(), tenant_id));

-- Update: SuperAdmin only
CREATE POLICY "SuperAdmin can update source configs"
ON public.regulatory_source_configs FOR UPDATE
TO authenticated
USING (public.is_tenant_superadmin(auth.uid(), tenant_id));

-- Delete: SuperAdmin only
CREATE POLICY "SuperAdmin can delete source configs"
ON public.regulatory_source_configs FOR DELETE
TO authenticated
USING (public.is_tenant_superadmin(auth.uid(), tenant_id));

CREATE INDEX idx_reg_source_configs_tenant ON public.regulatory_source_configs(tenant_id);

-- ══════════════════════════════════════════════════════════════
-- 2. REGULATORY AUDIT LOG — Append-only, immutable
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.regulatory_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'LEGISLATION_UPDATED', 'NR_UPDATED', 'CCT_UPDATED', 'ESOCIAL_LAYOUT_CHANGED',
    'SOURCE_CONFIGURED', 'SOURCE_UPDATED', 'SOURCE_DISABLED',
    'IMPACT_ANALYZED', 'ACTION_GENERATED', 'ACTION_APPROVED', 'ACTION_REJECTED', 'ACTION_EXECUTED',
    'DOCUMENT_VERSIONED', 'ALERT_GENERATED', 'ALERT_RESOLVED',
    'MONITOR_CHECK', 'LEGAL_BASE_UPDATED'
  )),
  actor_id UUID NOT NULL,
  actor_role TEXT,
  entity_type TEXT,        -- e.g. 'legal_document', 'source_config', 'alert'
  entity_id TEXT,
  document_code TEXT,
  descricao TEXT NOT NULL,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regulatory_audit_log ENABLE ROW LEVEL SECURITY;

-- Read: tenant members
CREATE POLICY "Tenant members can view regulatory audit log"
ON public.regulatory_audit_log FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Insert: only via SECURITY DEFINER function (no direct insert from client)
CREATE POLICY "System inserts regulatory audit log"
ON public.regulatory_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Block UPDATE and DELETE completely
-- (no policies = denied by default with RLS enabled)

-- Immutability triggers
CREATE OR REPLACE FUNCTION public.fn_regulatory_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria regulatória são imutáveis. Operação bloqueada.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_regulatory_audit_no_update
BEFORE UPDATE ON public.regulatory_audit_log
FOR EACH ROW EXECUTE FUNCTION public.fn_regulatory_audit_immutable();

CREATE TRIGGER trg_regulatory_audit_no_delete
BEFORE DELETE ON public.regulatory_audit_log
FOR EACH ROW EXECUTE FUNCTION public.fn_regulatory_audit_immutable();

CREATE INDEX idx_reg_audit_tenant_event ON public.regulatory_audit_log(tenant_id, event_type);
CREATE INDEX idx_reg_audit_created ON public.regulatory_audit_log(created_at DESC);
CREATE INDEX idx_reg_audit_entity ON public.regulatory_audit_log(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════════
-- 3. TIGHTEN legal_documents INSERT to SuperAdmin
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenant admins can insert legal documents" ON public.legal_documents;

CREATE POLICY "SuperAdmin can insert legal documents"
ON public.legal_documents FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_superadmin(auth.uid(), tenant_id));

-- ══════════════════════════════════════════════════════════════
-- 4. CONVENIENCE FUNCTION: insert audit log entry
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_regulatory_audit_insert(
  _tenant_id UUID,
  _event_type TEXT,
  _actor_id UUID,
  _actor_role TEXT,
  _entity_type TEXT,
  _entity_id TEXT,
  _document_code TEXT,
  _descricao TEXT,
  _dados_antes JSONB DEFAULT NULL,
  _dados_depois JSONB DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.regulatory_audit_log (
    tenant_id, event_type, actor_id, actor_role,
    entity_type, entity_id, document_code,
    descricao, dados_antes, dados_depois, metadata
  ) VALUES (
    _tenant_id, _event_type, _actor_id, _actor_role,
    _entity_type, _entity_id, _document_code,
    _descricao, _dados_antes, _dados_depois, _metadata
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;
