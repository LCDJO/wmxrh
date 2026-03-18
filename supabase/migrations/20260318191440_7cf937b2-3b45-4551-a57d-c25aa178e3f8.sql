-- Enable DocuSign in tenant signature integration constraints and harden RPCs for tenant-side configuration.

ALTER TABLE public.tenant_signature_integrations
  DROP CONSTRAINT IF EXISTS tenant_signature_integrations_provider_check;

ALTER TABLE public.tenant_signature_integrations
  ADD CONSTRAINT tenant_signature_integrations_provider_check
  CHECK (provider_name IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign', 'docusign'));

ALTER TABLE public.tenant_signature_integration_secrets
  DROP CONSTRAINT IF EXISTS tenant_signature_integration_secrets_provider_check;

ALTER TABLE public.tenant_signature_integration_secrets
  ADD CONSTRAINT tenant_signature_integration_secrets_provider_check
  CHECK (provider_name IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign', 'docusign'));

DROP FUNCTION IF EXISTS public.upsert_tenant_signature_integration(uuid, text, boolean, boolean, text, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.upsert_tenant_signature_integration(uuid, text, text, text, boolean, boolean, jsonb, text, text);
DROP FUNCTION IF EXISTS public.upsert_tenant_signature_integration(uuid, text, text, text, boolean, boolean, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_tenant_signature_integration(
  _tenant_id uuid,
  _provider_name text,
  _account_id text DEFAULT NULL,
  _client_id text DEFAULT NULL,
  _is_enabled boolean DEFAULT true,
  _is_default boolean DEFAULT false,
  _provider_metadata jsonb DEFAULT '{}'::jsonb,
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
  v_row public.tenant_signature_integrations;
  _jwt_secret text := current_setting('app.settings.jwt_secret', true);
BEGIN
  IF NOT public.is_tenant_signature_admin(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _provider_name NOT IN ('simulation', 'opensign', 'clicksign', 'autentique', 'zapsign', 'docusign') THEN
    RAISE EXCEPTION 'Unsupported signature provider: %', _provider_name;
  END IF;

  INSERT INTO public.tenant_signature_integrations (
    tenant_id,
    provider_name,
    account_id,
    client_id,
    is_enabled,
    is_default,
    provider_metadata,
    created_by,
    updated_by
  ) VALUES (
    _tenant_id,
    _provider_name,
    NULLIF(btrim(_account_id), ''),
    NULLIF(btrim(_client_id), ''),
    COALESCE(_is_enabled, true),
    COALESCE(_is_default, false),
    COALESCE(_provider_metadata, '{}'::jsonb),
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (tenant_id, provider_name)
  DO UPDATE SET
    account_id = EXCLUDED.account_id,
    client_id = EXCLUDED.client_id,
    is_enabled = EXCLUDED.is_enabled,
    is_default = EXCLUDED.is_default,
    provider_metadata = EXCLUDED.provider_metadata,
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

  RETURN QUERY
  SELECT *
  FROM public.tenant_signature_integrations
  WHERE id = v_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_tenant_signature_integration(uuid, text, text, text, boolean, boolean, jsonb, text, text, text) TO authenticated;