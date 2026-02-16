
-- Add certificate and signed term URL fields to nr_training_assignments
-- These are denormalized from completions for quick access on the assignment record
ALTER TABLE public.nr_training_assignments
  ADD COLUMN IF NOT EXISTS certificado_url text,
  ADD COLUMN IF NOT EXISTS termo_assinado_url text,
  ADD COLUMN IF NOT EXISTS data_realizacao date,
  ADD COLUMN IF NOT EXISTS data_validade date,
  ADD COLUMN IF NOT EXISTS instrutor text;

COMMENT ON COLUMN public.nr_training_assignments.certificado_url IS 'URL do certificado de conclusão (storage)';
COMMENT ON COLUMN public.nr_training_assignments.termo_assinado_url IS 'URL do termo de ciência assinado (storage)';
COMMENT ON COLUMN public.nr_training_assignments.data_realizacao IS 'Data de realização do treinamento';
COMMENT ON COLUMN public.nr_training_assignments.data_validade IS 'Data de validade do treinamento';
COMMENT ON COLUMN public.nr_training_assignments.instrutor IS 'Nome do instrutor/entidade';
