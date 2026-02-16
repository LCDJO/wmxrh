
-- Step 1: Add new role values to tenant_role enum only
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'tenant_admin';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'group_admin';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'rh';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'financeiro';
