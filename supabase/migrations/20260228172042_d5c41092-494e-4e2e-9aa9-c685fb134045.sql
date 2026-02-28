
-- Create plan_change_history to track all plan transitions
CREATE TABLE public.plan_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  from_plan_id uuid REFERENCES public.saas_plans(id),
  to_plan_id uuid REFERENCES public.saas_plans(id),
  change_type text NOT NULL, -- 'upgrade' | 'downgrade' | 'trial_start' | 'cancellation' | 'reactivation'
  new_status text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.plan_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view plan change history"
  ON public.plan_change_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
    )
  );

CREATE INDEX idx_plan_change_tenant ON public.plan_change_history(tenant_id, changed_at DESC);

-- Auto-log plan changes via trigger on tenant_plans
CREATE OR REPLACE FUNCTION public.log_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.plan_change_history (tenant_id, from_plan_id, to_plan_id, change_type, new_status)
    VALUES (
      NEW.tenant_id,
      OLD.plan_id,
      NEW.plan_id,
      CASE
        WHEN OLD.status = 'cancelled' AND NEW.status = 'trial' THEN 'trial_start'
        WHEN NEW.status = 'cancelled' THEN 'cancellation'
        WHEN OLD.status IN ('cancelled','suspended') AND NEW.status = 'active' THEN 'reactivation'
        WHEN OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN 'plan_change'
        ELSE 'status_change'
      END,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_log_plan_change
  AFTER UPDATE ON public.tenant_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_plan_change();
