
-- Fix: Set view to SECURITY INVOKER (respects caller's RLS)
ALTER VIEW public.pcmso_exam_alerts SET (security_invoker = on);
