
-- Add operacao_restrita flag to employees table
ALTER TABLE public.employees 
ADD COLUMN operacao_restrita boolean NOT NULL DEFAULT false;

-- Add restriction metadata (which NRs caused the block)
ALTER TABLE public.employees 
ADD COLUMN restricao_motivo jsonb DEFAULT NULL;

-- Index for quick lookup of restricted employees
CREATE INDEX idx_employees_operacao_restrita 
ON public.employees (operacao_restrita) 
WHERE operacao_restrita = true;

-- Comment for documentation
COMMENT ON COLUMN public.employees.operacao_restrita IS 'True when employee has expired mandatory NR training that blocks function execution';
COMMENT ON COLUMN public.employees.restricao_motivo IS 'JSON with details of which NRs caused the restriction, e.g. [{nr: 10, assignment_id: "...", expired_at: "..."}]';
