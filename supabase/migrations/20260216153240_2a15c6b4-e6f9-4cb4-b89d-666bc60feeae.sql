
-- ═══════════════════════════════════════════════════════════════
-- PCMSO: Periodicidade + Alertas de vencimento
-- ═══════════════════════════════════════════════════════════════

-- 1. Add exam periodicity to health_programs
ALTER TABLE public.health_programs
  ADD COLUMN IF NOT EXISTS exam_periodicity_months integer NOT NULL DEFAULT 12;

-- 2. Add next_exam_date to employee_health_exams
ALTER TABLE public.employee_health_exams
  ADD COLUMN IF NOT EXISTS next_exam_date date;

-- 3. Auto-calculate next_exam_date on insert/update
CREATE OR REPLACE FUNCTION public.calculate_next_exam_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _periodicity integer;
BEGIN
  IF NEW.health_program_id IS NOT NULL THEN
    SELECT exam_periodicity_months INTO _periodicity
    FROM public.health_programs WHERE id = NEW.health_program_id;
  END IF;
  
  IF _periodicity IS NULL THEN _periodicity := 12; END IF;
  
  -- Only auto-set if not manually provided
  IF NEW.next_exam_date IS NULL AND NEW.result != 'inapto' THEN
    NEW.next_exam_date := NEW.exam_date + (_periodicity || ' months')::interval;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_next_exam_date
  BEFORE INSERT OR UPDATE ON public.employee_health_exams
  FOR EACH ROW EXECUTE FUNCTION public.calculate_next_exam_date();

-- 4. View: exams expiring or overdue
CREATE OR REPLACE VIEW public.pcmso_exam_alerts AS
SELECT
  e.id AS exam_id,
  e.tenant_id,
  e.employee_id,
  emp.name AS employee_name,
  emp.company_id,
  e.exam_type,
  e.exam_date,
  e.next_exam_date,
  e.result,
  e.health_program_id,
  hp.name AS program_name,
  CASE
    WHEN e.next_exam_date < CURRENT_DATE THEN 'overdue'
    WHEN e.next_exam_date <= CURRENT_DATE + interval '30 days' THEN 'expiring_soon'
    WHEN e.next_exam_date <= CURRENT_DATE + interval '60 days' THEN 'upcoming'
    ELSE 'ok'
  END AS alert_status,
  e.next_exam_date - CURRENT_DATE AS days_until_due
FROM public.employee_health_exams e
JOIN public.employees emp ON emp.id = e.employee_id
LEFT JOIN public.health_programs hp ON hp.id = e.health_program_id
WHERE e.deleted_at IS NULL
  AND e.is_valid = true
  AND emp.deleted_at IS NULL
  AND emp.status = 'active';
