-- Add encrypted private key storage for DocuSign JWT auth
ALTER TABLE public.tenant_signature_integration_secrets
ADD COLUMN IF NOT EXISTS private_key_encrypted bytea;

-- Extend secret resolver to return DocuSign private key when present
DROP FUNCTION IF EXISTS public.get_tenant_signature_provider_secret(uuid, text);
CREATE OR REPLACE FUNCTION public.get_tenant_signature_provider_secret(
  _tenant_id uuid,
  _provider_name text
)
RETURNS TABLE (
  api_key text,
  webhook_secret text,
  private_key text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _jwt_secret text;
  _allowed boolean := false;
BEGIN
  SELECT value INTO _jwt_secret
  FROM app_settings
  WHERE key = 'jwt_secret'
  LIMIT 1;

  IF auth.role() = 'service_role' THEN
    _allowed := true;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = _tenant_id
        AND ur.role IN ('admin', 'owner')
    ) INTO _allowed;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not authorized to access signature provider secrets';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN s.api_key_encrypted IS NULL OR _jwt_secret IS NULL THEN NULL
      ELSE pgp_sym_decrypt(s.api_key_encrypted, _jwt_secret)
    END AS api_key,
    CASE
      WHEN s.webhook_secret_encrypted IS NULL OR _jwt_secret IS NULL THEN NULL
      ELSE pgp_sym_decrypt(s.webhook_secret_encrypted, _jwt_secret)
    END AS webhook_secret,
    CASE
      WHEN s.private_key_encrypted IS NULL OR _jwt_secret IS NULL THEN NULL
      ELSE pgp_sym_decrypt(s.private_key_encrypted, _jwt_secret)
    END AS private_key
  FROM public.tenant_signature_integration_secrets s
  WHERE s.tenant_id = _tenant_id
    AND s.provider_name = _provider_name
  LIMIT 1;
END;
$$;

-- Extend integration upsert RPC to securely persist the DocuSign private key
DROP FUNCTION IF EXISTS public.upsert_tenant_signature_integration(uuid, text, text, text, boolean, boolean, jsonb, text, text);
CREATE OR REPLACE FUNCTION public.upsert_tenant_signature_integration(
  _tenant_id uuid,
  _provider_name text,
  _base_url text DEFAULT NULL,
  _account_id text DEFAULT NULL,
  _is_enabled boolean DEFAULT true,
  _is_default boolean DEFAULT false,
  _config jsonb DEFAULT '{}'::jsonb,
  _api_key text DEFAULT NULL,
  _webhook_secret text DEFAULT NULL,
  _private_key text DEFAULT NULL
)
RETURNS SETOF public.tenant_signature_integrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _jwt_secret text;
  _result public.tenant_signature_integrations;
  _allowed boolean := false;
BEGIN
  SELECT value INTO _jwt_secret
  FROM app_settings
  WHERE key = 'jwt_secret'
  LIMIT 1;

  IF auth.role() = 'service_role' THEN
    _allowed := true;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = _tenant_id
        AND ur.role IN ('admin', 'owner')
    ) INTO _allowed;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not authorized to manage signature integrations';
  END IF;

  IF _is_default THEN
    UPDATE public.tenant_signature_integrations
    SET is_default = false,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE tenant_id = _tenant_id
      AND provider_name <> _provider_name;
  END IF;

  INSERT INTO public.tenant_signature_integrations (
    tenant_id,
    provider_name,
    base_url,
    account_id,
    is_enabled,
    is_default,
    config,
    created_by,
    updated_by
  ) VALUES (
    _tenant_id,
    _provider_name,
    NULLIF(_base_url, ''),
    NULLIF(_account_id, ''),
    COALESCE(_is_enabled, true),
    COALESCE(_is_default, false),
    COALESCE(_config, '{}'::jsonb),
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (tenant_id, provider_name)
  DO UPDATE SET
    base_url = EXCLUDED.base_url,
    account_id = EXCLUDED.account_id,
    is_enabled = EXCLUDED.is_enabled,
    is_default = EXCLUDED.is_default,
    config = EXCLUDED.config,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO _result;

  IF _jwt_secret IS NOT NULL THEN
    INSERT INTO public.tenant_signature_integration_secrets (
      tenant_id,
      provider_name,
      api_key_encrypted,
      webhook_secret_encrypted,
      private_key_encrypted,
      updated_at
    ) VALUES (
      _tenant_id,
      _provider_name,
      CASE WHEN NULLIF(_api_key, '') IS NULL THEN NULL ELSE pgp_sym_encrypt(_api_key, _jwt_secret) END,
      CASE WHEN NULLIF(_webhook_secret, '') IS NULL THEN NULL ELSE pgp_sym_encrypt(_webhook_secret, _jwt_secret) END,
      CASE WHEN NULLIF(_private_key, '') IS NULL THEN NULL ELSE pgp_sym_encrypt(_private_key, _jwt_secret) END,
      now()
    )
    ON CONFLICT (tenant_id, provider_name)
    DO UPDATE SET
      api_key_encrypted = CASE
        WHEN NULLIF(_api_key, '') IS NULL THEN public.tenant_signature_integration_secrets.api_key_encrypted
        ELSE pgp_sym_encrypt(_api_key, _jwt_secret)
      END,
      webhook_secret_encrypted = CASE
        WHEN NULLIF(_webhook_secret, '') IS NULL THEN public.tenant_signature_integration_secrets.webhook_secret_encrypted
        ELSE pgp_sym_encrypt(_webhook_secret, _jwt_secret)
      END,
      private_key_encrypted = CASE
        WHEN NULLIF(_private_key, '') IS NULL THEN public.tenant_signature_integration_secrets.private_key_encrypted
        ELSE pgp_sym_encrypt(_private_key, _jwt_secret)
      END,
      updated_at = now();
  END IF;

  RETURN NEXT _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_signature_provider_secret(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_signature_integration(uuid, text, text, text, boolean, boolean, jsonb, text, text, text) TO authenticated, service_role;