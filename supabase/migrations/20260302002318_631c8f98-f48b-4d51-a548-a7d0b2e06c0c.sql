
-- Performance Review Cycles
CREATE TABLE public.performance_review_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('90','180','360')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  participants_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation performance_review_cycles" ON public.performance_review_cycles FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

CREATE TRIGGER update_performance_review_cycles_updated_at
  BEFORE UPDATE ON public.performance_review_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Individual Employee Reviews (IMMUTABLE — no UPDATE/DELETE allowed after submission)
CREATE TABLE public.employee_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cycle_id UUID NOT NULL REFERENCES public.performance_review_cycles(id),
  employee_id UUID NOT NULL,
  reviewer_id TEXT NOT NULL,
  review_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  overall_score NUMERIC,
  competency_scores JSONB NOT NULL DEFAULT '[]',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  improvement_areas TEXT[] NOT NULL DEFAULT '{}',
  goals_achieved INT NOT NULL DEFAULT 0,
  goals_total INT NOT NULL DEFAULT 0,
  feedback TEXT,
  submitted_at TIMESTAMPTZ,
  calibrated_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation employee_reviews" ON public.employee_reviews FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

CREATE INDEX idx_employee_reviews_cycle ON public.employee_reviews(cycle_id, status);
CREATE INDEX idx_employee_reviews_employee ON public.employee_reviews(employee_id, created_at DESC);

CREATE TRIGGER update_employee_reviews_updated_at
  BEFORE UPDATE ON public.employee_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutability trigger: block UPDATE/DELETE on submitted reviews
CREATE OR REPLACE FUNCTION public.protect_submitted_reviews()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Cannot delete a completed review (immutability rule)';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'completed' AND NEW.status != OLD.status THEN
      RAISE EXCEPTION 'Cannot modify a completed review (immutability rule)';
    END IF;
    -- Allow calibration update only
    IF OLD.status = 'completed' AND (
      NEW.overall_score IS DISTINCT FROM OLD.overall_score OR
      NEW.competency_scores IS DISTINCT FROM OLD.competency_scores OR
      NEW.strengths IS DISTINCT FROM OLD.strengths OR
      NEW.improvement_areas IS DISTINCT FROM OLD.improvement_areas OR
      NEW.feedback IS DISTINCT FROM OLD.feedback
    ) THEN
      RAISE EXCEPTION 'Cannot alter evaluation data after submission. Only calibrated_score can be updated.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER protect_submitted_reviews_trigger
  BEFORE UPDATE OR DELETE ON public.employee_reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_reviews();

-- Employee Goals (linked to cycles)
CREATE TABLE public.employee_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  cycle_id UUID REFERENCES public.performance_review_cycles(id),
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT,
  target_value NUMERIC,
  current_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'not_started',
  weight NUMERIC NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation employee_goals" ON public.employee_goals FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

CREATE TRIGGER update_employee_goals_updated_at
  BEFORE UPDATE ON public.employee_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
