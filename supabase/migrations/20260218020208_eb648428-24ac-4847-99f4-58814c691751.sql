-- Add layer-specific version columns for two-layer modules (e.g. support_module)
ALTER TABLE public.module_versions
  ADD COLUMN IF NOT EXISTS tenant_app_version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_console_version text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.module_versions.tenant_app_version IS 'Versão da camada Tenant App (ex: support_module tenant experience)';
COMMENT ON COLUMN public.module_versions.platform_console_version IS 'Versão da camada Platform Console (ex: support_module SaaS console)';