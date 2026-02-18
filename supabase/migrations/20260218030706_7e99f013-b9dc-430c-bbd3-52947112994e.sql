
-- Add platform_support_coordinator to the platform_role enum
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'platform_support_coordinator';
