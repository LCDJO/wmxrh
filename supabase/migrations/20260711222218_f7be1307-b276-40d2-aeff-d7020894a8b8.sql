
-- 2. fleet_provider_configs: restrict SELECT to owner/admin roles only
DROP POLICY IF EXISTS "Tenant members can read fleet config" ON public.fleet_provider_configs;
CREATE POLICY "Fleet admins can read fleet config" ON public.fleet_provider_configs
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('owner'::tenant_role, 'admin'::tenant_role, 'tenant_admin'::tenant_role, 'superadmin'::tenant_role)
    )
  );

-- 3. contact_messages: restrict UPDATE/DELETE to platform admins only
DROP POLICY IF EXISTS "Authenticated users can update contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Authenticated users can delete contact messages" ON public.contact_messages;
CREATE POLICY "Platform admins can update contact messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid() AND pu.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid() AND pu.status = 'active'));
CREATE POLICY "Platform admins can delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid() AND pu.status = 'active'));

-- 4. Storage: chat-attachments — tenant folder scoping
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Tenant members can view chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );
CREATE POLICY "Tenant members can upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- 5. Storage: signed-documents INSERT tenant folder scoping
DROP POLICY IF EXISTS "Authenticated users can upload signed documents" ON storage.objects;
CREATE POLICY "Tenant members can upload signed documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signed-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- 6. Telegram bot_token → Supabase Vault
ALTER TABLE public.telegram_bot_configs
  ADD COLUMN IF NOT EXISTS bot_token_vault_id uuid;

DO $$
DECLARE
  r RECORD;
  v_secret_id uuid;
BEGIN
  FOR r IN
    SELECT id, bot_token
      FROM public.telegram_bot_configs
     WHERE bot_token IS NOT NULL
       AND bot_token <> ''
       AND bot_token_vault_id IS NULL
  LOOP
    BEGIN
      SELECT vault.create_secret(r.bot_token, 'telegram_bot_' || r.id::text)
        INTO v_secret_id;
      UPDATE public.telegram_bot_configs
         SET bot_token_vault_id = v_secret_id
       WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not migrate telegram bot_token for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END$$;

ALTER TABLE public.telegram_bot_configs DROP COLUMN IF EXISTS bot_token;

CREATE OR REPLACE FUNCTION public.get_telegram_bot_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_secret text;
BEGIN
  SELECT bot_token_vault_id INTO v_id
    FROM public.telegram_bot_configs
   WHERE tenant_id = p_tenant_id;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE id = v_id;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_telegram_bot_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_telegram_bot_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_telegram_bot_token(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_bot_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_telegram_bot_token(p_tenant_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_new uuid;
BEGIN
  SELECT bot_token_vault_id INTO v_existing
    FROM public.telegram_bot_configs
   WHERE tenant_id = p_tenant_id;

  IF v_existing IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing, p_token);
  ELSE
    SELECT vault.create_secret(p_token, 'telegram_bot_tenant_' || p_tenant_id::text)
      INTO v_new;
    UPDATE public.telegram_bot_configs
       SET bot_token_vault_id = v_new
     WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_telegram_bot_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_telegram_bot_token(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_telegram_bot_token(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_telegram_bot_token(uuid, text) TO service_role;
