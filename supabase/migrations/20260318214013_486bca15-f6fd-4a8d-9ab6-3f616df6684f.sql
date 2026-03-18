ALTER TABLE public.employee_personal_data
ADD COLUMN IF NOT EXISTS cpf_lookup_status text NOT NULL DEFAULT 'not_attempted',
ADD COLUMN IF NOT EXISTS cpf_lookup_pending_reason text NULL,
ADD COLUMN IF NOT EXISTS cpf_lookup_checked_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS cpf_lookup_source text NULL;

COMMENT ON COLUMN public.employee_personal_data.cpf_lookup_status IS 'Status da consulta automática de CPF: resolved, pending_manual, integration_off, lookup_failed, not_attempted.';
COMMENT ON COLUMN public.employee_personal_data.cpf_lookup_pending_reason IS 'Motivo da pendência quando a consulta de CPF não foi concluída automaticamente.';
COMMENT ON COLUMN public.employee_personal_data.cpf_lookup_checked_at IS 'Data/hora da última tentativa ou decisão sobre a consulta automática de CPF.';
COMMENT ON COLUMN public.employee_personal_data.cpf_lookup_source IS 'Origem usada na consulta de CPF quando resolvida automaticamente.';