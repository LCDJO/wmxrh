-- Create RPC to securely set webhook secret (encrypts on server)
CREATE OR REPLACE FUNCTION public.set_webhook_secret(_webhook_id uuid, _secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_configurations
  SET secret_encrypted = CASE 
    WHEN _secret IS NOT NULL AND _secret != '' 
    THEN pgp_sym_encrypt(_secret, current_setting('app.settings.jwt_secret', true))
    ELSE NULL
  END,
  updated_at = now()
  WHERE id = _webhook_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_webhook_secret FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_webhook_secret TO authenticated;
