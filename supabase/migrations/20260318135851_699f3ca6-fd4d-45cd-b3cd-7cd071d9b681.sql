-- Fix tenant signature secret encryption/decryption and add provider resolution helpers.
ALTER TABLE public.tenant_signature_integration_secrets
  ALTER COLUMN api_key_encrypted TYPE BYTEA USING NULL::bytea,
  ALTER COLUMN webhook_secret_encrypted TYPE BYTEA USING NULL::bytea;

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
      THEN extensions.pgp_sym_encrypt(_api_key, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END,
    CASE
      WHEN _webhook_secret IS NOT NULL AND btrim(_webhook_secret) <> ''
      THEN extensions.pgp_sym_encrypt(_webhook_secret, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END
  )
  ON CONFLICT (tenant_id, provider_name)
  DO UPDATE SET
    api_key_encrypted = CASE
      WHEN _api_key IS NOT NULL AND btrim(_api_key) <> ''
      THEN extensions.pgp_sym_encrypt(_api_key, current_setting('app.settings.jwt_secret', true))
      ELSE public.tenant_signature_integration_secrets.api_key_encrypted
    END,
    webhook_secret_encrypted = CASE
      WHEN _webhook_secret IS NOT NULL AND btrim(_webhook_secret) <> ''
      THEN extensions.pgp_sym_encrypt(_webhook_secret, current_setting('app.settings.jwt_secret', true))
      ELSE public.tenant_signature_integration_secrets.webhook_secret_encrypted
    END,
    updated_at = now();

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_tenant_signature_provider(_tenant_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  provider_name TEXT,
  base_url TEXT,
  account_id TEXT,
  config JSONB,
  has_api_key BOOLEAN,
  has_webhook_secret BOOLEAN,
  is_enabled BOOLEAN,
  is_default BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.tenant_id,
    i.provider_name,
    i.base_url,
    i.account_id,
    i.config,
    (s.api_key_encrypted IS NOT NULL) AS has_api_key,
    (s.webhook_secret_encrypted IS NOT NULL) AS has_webhook_secret,
    i.is_enabled,
    i.is_default
  FROM public.tenant_signature_integrations i
  LEFT JOIN public.tenant_signature_integration_secrets s
    ON s.tenant_id = i.tenant_id
   AND s.provider_name = i.provider_name
  WHERE i.tenant_id = _tenant_id
    AND i.is_enabled = true
    AND (
      i.is_default = true
      OR NOT EXISTS (
        SELECT 1
        FROM public.tenant_signature_integrations di
        WHERE di.tenant_id = _tenant_id
          AND di.is_enabled = true
          AND di.is_default = true
      )
    )
    AND (
      i.tenant_id IN (
        SELECT tm.tenant_id
        FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'active'
      )
      OR public.is_platform_user(auth.uid())
    )
  ORDER BY i.is_default DESC, i.updated_at DESC, i.provider_name ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_signature_provider_secret(
  _tenant_id UUID,
  _provider_name TEXT
)
RETURNS TABLE (
  api_key TEXT,
  webhook_secret TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN s.api_key_encrypted IS NOT NULL
      THEN extensions.pgp_sym_decrypt(s.api_key_encrypted, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END AS api_key,
    CASE
      WHEN s.webhook_secret_encrypted IS NOT NULL
      THEN extensions.pgp_sym_decrypt(s.webhook_secret_encrypted, current_setting('app.settings.jwt_secret', true))
      ELSE NULL
    END AS webhook_secret
  FROM public.tenant_signature_integration_secrets s
  WHERE s.tenant_id = _tenant_id
    AND s.provider_name = _provider_name
    AND (
      public.is_platform_user(auth.uid())
      OR public.is_tenant_signature_admin(_tenant_id, auth.uid())
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_signature_provider(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_signature_provider_secret(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_signature_integration(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;