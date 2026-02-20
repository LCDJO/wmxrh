-- Add phone column to tenant_memberships for user profile CRUD
ALTER TABLE public.tenant_memberships ADD COLUMN IF NOT EXISTS phone text;
