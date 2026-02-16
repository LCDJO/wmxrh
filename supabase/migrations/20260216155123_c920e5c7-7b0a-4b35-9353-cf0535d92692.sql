
ALTER TABLE public.labor_rule_sets
  ADD COLUMN uf TEXT,
  ADD COLUMN categoria_profissional TEXT;

CREATE INDEX idx_labor_rule_sets_uf ON public.labor_rule_sets(uf);
