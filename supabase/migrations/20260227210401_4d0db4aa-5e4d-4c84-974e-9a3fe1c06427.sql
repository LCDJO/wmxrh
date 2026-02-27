
-- Signing keys for JWT (RS256 rotating keys)
CREATE TABLE public.federation_signing_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kid TEXT NOT NULL UNIQUE,
  algorithm TEXT NOT NULL DEFAULT 'RS256',
  public_key_jwk JSONB NOT NULL,
  private_key_jwk JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_signing_keys_status ON public.federation_signing_keys(status);
CREATE INDEX idx_signing_keys_kid ON public.federation_signing_keys(kid);

ALTER TABLE public.federation_signing_keys ENABLE ROW LEVEL SECURITY;

-- Only service_role
CREATE POLICY "Service role manages signing keys"
  ON public.federation_signing_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Deny anon signing keys"
  ON public.federation_signing_keys
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Deny authenticated signing keys"
  ON public.federation_signing_keys
  FOR ALL
  TO authenticated
  USING (false);
