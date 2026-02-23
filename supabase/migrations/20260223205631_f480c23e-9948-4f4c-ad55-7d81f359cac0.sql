-- Add versao column to employee_agreements
ALTER TABLE public.employee_agreements
  ADD COLUMN IF NOT EXISTS versao INT NOT NULL DEFAULT 1;

-- Create trigger to prevent DELETE on employee_agreements (never delete history)
CREATE OR REPLACE FUNCTION public.prevent_employee_agreement_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Não é permitido excluir registros de employee_agreements. Use status expirado ou revogado.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_employee_agreement_delete
  BEFORE DELETE ON public.employee_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_agreement_delete();

-- Add index on versao
CREATE INDEX IF NOT EXISTS idx_ea_versao ON public.employee_agreements(employee_id, template_id, versao);
