-- Add max_employees column to saas_plans
ALTER TABLE public.saas_plans ADD COLUMN max_employees integer DEFAULT NULL;

-- Free = 5, Enterprise = unlimited (NULL)
UPDATE public.saas_plans SET max_employees = 5 WHERE name = 'Free';
UPDATE public.saas_plans SET max_employees = 20 WHERE name = 'Basic';
UPDATE public.saas_plans SET max_employees = 100 WHERE name = 'Pro';
UPDATE public.saas_plans SET max_employees = NULL WHERE name = 'Enterprise';

COMMENT ON COLUMN public.saas_plans.max_employees IS 'Max employees allowed. NULL = unlimited.';