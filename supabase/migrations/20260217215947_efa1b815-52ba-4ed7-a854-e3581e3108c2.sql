
-- Add new platform support roles to the enum
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'platform_support_agent';
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'platform_support_manager';
