
-- ═══════════════════════════════════════════════════════════════
-- Account Status Model — Unified status for Tenant, User, DeveloperApp
-- ═══════════════════════════════════════════════════════════════

-- 1) Create enum
CREATE TYPE public.account_status AS ENUM ('active', 'restricted', 'suspended', 'banned', 'under_review');

-- 2) Add account_status column to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

-- 3) Add account_status column to platform_users
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

-- 4) Add account_status column to api_clients (DeveloperApp)
ALTER TABLE public.api_clients
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

-- 5) Extend account_enforcements to support all entity types
ALTER TABLE public.account_enforcements
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'tenant' CHECK (entity_type IN ('tenant', 'user', 'developer_app')),
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Backfill entity_id from tenant_id for existing records
UPDATE public.account_enforcements SET entity_id = tenant_id WHERE entity_id IS NULL;

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_account_status ON public.tenants(account_status);
CREATE INDEX IF NOT EXISTS idx_platform_users_account_status ON public.platform_users(account_status);
CREATE INDEX IF NOT EXISTS idx_api_clients_account_status ON public.api_clients(account_status);
CREATE INDEX IF NOT EXISTS idx_enforcements_entity ON public.account_enforcements(entity_type, entity_id);

-- 7) Function to sync enforcement → entity account_status
CREATE OR REPLACE FUNCTION public.sync_account_status_on_enforcement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF NEW.entity_type = 'tenant' AND NEW.entity_id IS NOT NULL THEN
      UPDATE public.tenants SET account_status = NEW.action_type::public.account_status WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'user' AND NEW.entity_id IS NOT NULL THEN
      UPDATE public.platform_users SET account_status = NEW.action_type::public.account_status WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'developer_app' AND NEW.entity_id IS NOT NULL THEN
      UPDATE public.api_clients SET account_status = NEW.action_type::public.account_status WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.status = 'revoked' THEN
    -- Check if there are other active enforcements; if not, restore to 'active'
    IF NEW.entity_type = 'tenant' AND NEW.entity_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.account_enforcements WHERE entity_id = NEW.entity_id AND entity_type = 'tenant' AND status = 'active' AND id != NEW.id) THEN
        UPDATE public.tenants SET account_status = 'active' WHERE id = NEW.entity_id;
      END IF;
    ELSIF NEW.entity_type = 'user' AND NEW.entity_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.account_enforcements WHERE entity_id = NEW.entity_id AND entity_type = 'user' AND status = 'active' AND id != NEW.id) THEN
        UPDATE public.platform_users SET account_status = 'active' WHERE id = NEW.entity_id;
      END IF;
    ELSIF NEW.entity_type = 'developer_app' AND NEW.entity_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.account_enforcements WHERE entity_id = NEW.entity_id AND entity_type = 'developer_app' AND status = 'active' AND id != NEW.id) THEN
        UPDATE public.api_clients SET account_status = 'active' WHERE id = NEW.entity_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sync_account_status
  AFTER INSERT OR UPDATE OF status ON public.account_enforcements
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_status_on_enforcement();
