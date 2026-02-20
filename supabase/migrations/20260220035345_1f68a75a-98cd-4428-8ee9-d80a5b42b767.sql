
-- Add missing CareerPosition fields to existing positions table
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS formacao_minima TEXT,
  ADD COLUMN IF NOT EXISTS certificacoes_exigidas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Rename existing columns to match spec (base_salary -> faixa_salarial_min, max_salary -> faixa_salarial_max)
-- Keep originals as aliases via comment; actual rename for clarity
ALTER TABLE public.positions RENAME COLUMN base_salary TO faixa_salarial_min;
ALTER TABLE public.positions RENAME COLUMN max_salary TO faixa_salarial_max;

-- Add index for active positions lookup
CREATE INDEX IF NOT EXISTS idx_positions_ativo ON public.positions (tenant_id, ativo) WHERE deleted_at IS NULL;

-- Add index for CBO code lookups
CREATE INDEX IF NOT EXISTS idx_positions_cbo ON public.positions (tenant_id, cbo_code) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.positions IS 'CareerPosition — Estrutura de cargos com faixa salarial, nível, CBO, formação e certificações';
