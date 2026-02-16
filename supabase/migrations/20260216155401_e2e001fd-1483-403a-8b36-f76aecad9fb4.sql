
ALTER TABLE public.labor_rule_definitions
  ADD COLUMN percentual_sobre_hora NUMERIC,
  ADD COLUMN limite_horas NUMERIC,
  ADD COLUMN integra_salario BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN oncall_tipo TEXT CHECK (oncall_tipo IS NULL OR oncall_tipo IN ('plantao_presencial', 'sobreaviso'));

COMMENT ON COLUMN public.labor_rule_definitions.percentual_sobre_hora IS 'Percentual sobre hora normal para plantão/sobreaviso';
COMMENT ON COLUMN public.labor_rule_definitions.limite_horas IS 'Limite máximo de horas por período';
COMMENT ON COLUMN public.labor_rule_definitions.integra_salario IS 'Se integra salário para demais reflexos';
COMMENT ON COLUMN public.labor_rule_definitions.oncall_tipo IS 'Tipo de sobreaviso: plantao_presencial ou sobreaviso';

-- Update existing rules
UPDATE public.labor_rule_definitions
SET oncall_tipo = 'sobreaviso', percentual_sobre_hora = 33.33, base_calculo = 'hora_normal', integra_salario = false
WHERE category = 'sobreaviso';

UPDATE public.labor_rule_definitions
SET oncall_tipo = 'plantao_presencial', base_calculo = 'hora_normal', integra_salario = true
WHERE category = 'plantao';
