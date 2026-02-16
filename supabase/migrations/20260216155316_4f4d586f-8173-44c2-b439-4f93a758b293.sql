
ALTER TABLE public.labor_rule_definitions
  ADD COLUMN base_calculo TEXT,
  ADD COLUMN integra_dsr BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN aplica_reflexos BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.labor_rule_definitions.base_calculo IS 'Base de cálculo: hora_normal, salario_base, salario_minimo, etc.';
COMMENT ON COLUMN public.labor_rule_definitions.integra_dsr IS 'Se a verba integra DSR (reflexo)';
COMMENT ON COLUMN public.labor_rule_definitions.aplica_reflexos IS 'Se aplica reflexos em férias, 13º, FGTS, etc.';

-- Update existing overtime rules with proper metadata
UPDATE public.labor_rule_definitions
SET base_calculo = 'hora_normal', integra_dsr = true, aplica_reflexos = true
WHERE category = 'hora_extra';
