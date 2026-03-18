-- Secure tenant-level digital signature integrations (hybrid SaaS/tenant model)
-- SaaS/plan gates the module; each tenant stores and manages its own provider config securely.

CREATE TABLE IF NOT EXISTS public.tenant_signature_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  base_url TEXT NULL,
  account_id TEXT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ NULL,
  last_test_status TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT tenant_signature_integrations_provider_check
    CHECK (provider_name IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign')),
  CONSTRAINT tenant_signature_integrations_unique UNIQUE (tenant_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_signature_integrations_tenant
  ON public.tenant_signature_integrations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_signature_integrations_default
  ON public.tenant_signature_integrations (tenant_id, is_default)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.tenant_signature_integration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  api_key_encrypted TEXT NULL,
  webhook_secret_encrypted TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_signature_integration_secrets_provider_check
    CHECK (provider_name IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign')),
  CONSTRAINT tenant_signature_integration_secrets_unique UNIQUE (tenant_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_signature_integration_secrets_tenant
  ON public.tenant_signature_integration_secrets (tenant_id);

ALTER TABLE public.tenant_signature_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_signature_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at_tenant_signature_integrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_tenant_signature_integrations
ON public.tenant_signature_integrations;

CREATE TRIGGER set_updated_at_tenant_signature_integrations
BEFORE UPDATE ON public.tenant_signature_integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_tenant_signature_integrations();

CREATE OR REPLACE FUNCTION public.set_updated_at_tenant_signature_integration_secrets()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_tenant_signature_integration_secrets
ON public.tenant_signature_integration_secrets;

CREATE TRIGGER set_updated_at_tenant_signature_integration_secrets
BEFORE UPDATE ON public.tenant_signature_integration_secrets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_tenant_signature_integration_secrets();

CREATE OR REPLACE FUNCTION public.is_tenant_signature_admin(_tenant_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    LEFT JOIN public.user_roles ur
      ON ur.user_id = tm.user_id
     AND ur.tenant_id = tm.tenant_id
    WHERE tm.tenant_id = _tenant_id
      AND tm.user_id = _user_id
      AND tm.status = 'active'
      AND (
        COALESCE(ur.role::text, '') IN ('owner', 'admin', 'superadmin', 'tenant_admin')
      )
  );
$$;

DROP POLICY IF EXISTS "Tenant members can view signature integrations"
ON public.tenant_signature_integrations;
CREATE POLICY "Tenant members can view signature integrations"
ON public.tenant_signature_integrations
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id
    FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Tenant admins can insert signature integrations"
ON public.tenant_signature_integrations;
CREATE POLICY "Tenant admins can insert signature integrations"
ON public.tenant_signature_integrations
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_signature_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can update signature integrations"
ON public.tenant_signature_integrations;
CREATE POLICY "Tenant admins can update signature integrations"
ON public.tenant_signature_integrations
FOR UPDATE
TO authenticated
USING (public.is_tenant_signature_admin(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_signature_admin(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can delete signature integrations"
ON public.tenant_signature_integrations;
CREATE POLICY "Tenant admins can delete signature integrations"
ON public.tenant_signature_integrations
FOR DELETE
TO authenticated
USING (public.is_tenant_signature_admin(tenant_id, auth.uid()));

-- No authenticated policies on secrets table: only SECURITY DEFINER functions and service role may access.

CREATE OR REPLACE FUNCTION public.list_tenant_signature_integrations(_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  provider_name TEXT,
  is_enabled BOOLEAN,
  is_default BOOLEAN,
  base_url TEXT,
  account_id TEXT,
  config JSONB,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  has_api_key BOOLEAN,
  has_webhook_secret BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.tenant_id,
    i.provider_name,
    i.is_enabled,
    i.is_default,
    i.base_url,
    i.account_id,
    i.config,
    i.last_tested_at,
    i.last_test_status,
    i.last_error,
    i.created_at,
    i.updated_at,
    i.created_by,
    i.updated_by,
    (s.api_key_encrypted IS NOT NULL) AS has_api_key,
    (s.webhook_secret_encrypted IS NOT NULL) AS has_webhook_secret
  FROM public.tenant_signature_integrations i
  LEFT JOIN public.tenant_signature_integration_secrets s
    ON s.tenant_id = i.tenant_id
   AND s.provider_name = i.provider_name
  WHERE i.tenant_id = _tenant_id
    AND (
      i.tenant_id IN (
        SELECT tm.tenant_id
        FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'active'
      )
      OR public.is_platform_user(auth.uid())
    )
  ORDER BY i.is_default DESC, i.provider_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_tenant_signature_integration(
  _tenant_id UUID,
  _provider_name TEXT,
  _is_enabled BOOLEAN DEFAULT true,
  _is_default BOOLEAN DEFAULT false,
  _base_url TEXT DEFAULT NULL,
  _account_id TEXT DEFAULT NULL,
  _config JSONB DEFAULT '{}'::jsonb,
  _api_key TEXT DEFAULT NULL,
  _webhook_secret TEXT DEFAULT NULL
)
RETURNS public.tenant_signature_integrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tenant_signature_integrations;
BEGIN
  IF NOT public.is_tenant_signature_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores do tenant podem configurar integrações de assinatura.';
  END IF;

  IF _provider_name NOT IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign') THEN
    RAISE EXCEPTION 'Provider de assinatura inválido: %', _provider_name;
  END IF;

  INSERT INTO public.tenant_signature_integrations (
    tenant_id,
    provider_name,
    is_enabled,
    is_default,
    base_url,
    account_id,
    config,
    created_by,
    updated_by
  ) VALUES (
    _tenant_id,
    _provider_name,
    COALESCE(_is_enabled, true),
    COALESCE(_is_default, false),
    NULLIF(_base_url, ''),
    NULLIF(_account_id, ''),
    COALESCE(_config, '{}'::jsonb),
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (tenant_id, provider_name)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_default = EXCLUDED.is_default,
    base_url = EXCLUDED.base_url,
    account_id = EXCLUDED.account_id,
    config = EXCLUDED.config,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_row;

  IF COALESCE(_is_default, false) THEN
    UPDATE public.tenant_signature_integrations
    SET is_default = false,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE tenant_id = _tenant_id
      AND provider_name <> _provider_name
      AND is_default = true;
  END IF;

  INSERT INTO public.tenant_signature_integration_secrets (
    tenant_id,
    provider_name,
    api_key_encrypted,
    webhook_secret_encrypted
  ) VALUES (
    _tenant_id,
    _provider_name,
    CASE
      WHEN _api_key IS NOT NULL AND btrim(_api_key) <> ''
      THEN pgp_sym_encrypt(_api_key, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END,
    CASE
      WHEN _webhook_secret IS NOT NULL AND btrim(_webhook_secret) <> ''
      THEN pgp_sym_encrypt(_webhook_secret, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END
  )
  ON CONFLICT (tenant_id, provider_name)
  DO UPDATE SET
    api_key_encrypted = CASE
      WHEN _api_key IS NOT NULL AND btrim(_api_key) <> ''
      THEN pgp_sym_encrypt(_api_key, current_setting('app.settings.jwt_secret', true))
      ELSE public.tenant_signature_integration_secrets.api_key_encrypted
    END,
    webhook_secret_encrypted = CASE
      WHEN _webhook_secret IS NOT NULL AND btrim(_webhook_secret) <> ''
      THEN pgp_sym_encrypt(_webhook_secret, current_setting('app.settings.jwt_secret', true))
      ELSE public.tenant_signature_integration_secrets.webhook_secret_encrypted
    END,
    updated_at = now();

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_tenant_signature_integration(
  _tenant_id UUID,
  _provider_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tenant_signature_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores do tenant podem remover integrações de assinatura.';
  END IF;

  DELETE FROM public.tenant_signature_integration_secrets
  WHERE tenant_id = _tenant_id
    AND provider_name = _provider_name;

  DELETE FROM public.tenant_signature_integrations
  WHERE tenant_id = _tenant_id
    AND provider_name = _provider_name;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_signature_integrations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_signature_integration(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_tenant_signature_integration(UUID, TEXT) TO authenticated;