ALTER TABLE public.employee_personal_data
  ADD COLUMN banco TEXT,
  ADD COLUMN agencia TEXT,
  ADD COLUMN conta TEXT,
  ADD COLUMN tipo_conta TEXT DEFAULT 'corrente',
  ADD COLUMN chave_pix TEXT;