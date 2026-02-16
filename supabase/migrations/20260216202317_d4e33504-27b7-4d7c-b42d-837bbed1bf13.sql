
-- Add new values to platform_role enum
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'platform_operations';
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'platform_read_only';
