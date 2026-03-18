-- No schema changes required for CPF provider enablement.
-- Existing saas_plans.allowed_modules (text[]) and tenant_integration_configs.config (jsonb)
-- already support plan-scoped module flags and provider-specific configuration.
--
-- This migration is intentionally a no-op so the database history records that
-- CPF provider enablement is handled purely in application logic.
select 1;