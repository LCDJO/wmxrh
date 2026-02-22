-- Fix security_logs_result_check to accept 'success' value
ALTER TABLE public.security_logs DROP CONSTRAINT security_logs_result_check;
ALTER TABLE public.security_logs ADD CONSTRAINT security_logs_result_check CHECK (result = ANY (ARRAY['allowed'::text, 'blocked'::text, 'success'::text]));