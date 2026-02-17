
-- Create a sequence for protocol numbers, starting from 1
CREATE SEQUENCE IF NOT EXISTS public.support_protocol_seq START 1;

-- Function to generate PROTO-YYYY-XXXXX format
CREATE OR REPLACE FUNCTION public.generate_support_protocol()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('public.support_protocol_seq');
  RETURN 'PROTO-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 5, '0');
END;
$$;

-- Update the default on the column
ALTER TABLE public.support_chat_sessions
  ALTER COLUMN protocol_number SET DEFAULT public.generate_support_protocol();
