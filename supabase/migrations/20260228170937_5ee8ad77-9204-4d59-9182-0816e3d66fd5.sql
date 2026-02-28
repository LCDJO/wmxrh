-- Evolve tenant_plans into a full subscription model
-- Add missing columns for lifecycle governance

ALTER TABLE public.tenant_plans
  ADD COLUMN IF NOT EXISTS cycle_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS cycle_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz,
  ADD COLUMN IF NOT EXISTS downgrade_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id uuid REFERENCES public.saas_plans(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_payment_count integer NOT NULL DEFAULT 0;

-- Backfill cycle_start_date from started_at for existing rows
UPDATE public.tenant_plans
  SET cycle_start_date = started_at
  WHERE cycle_start_date IS NULL;

-- Backfill cycle_end_date based on billing_cycle
UPDATE public.tenant_plans
  SET cycle_end_date = CASE
    WHEN billing_cycle = 'yearly' THEN cycle_start_date + interval '1 year'
    ELSE cycle_start_date + interval '1 month'
  END
  WHERE cycle_end_date IS NULL AND cycle_start_date IS NOT NULL;

-- Backfill paid_until = cycle_end_date for active plans
UPDATE public.tenant_plans
  SET paid_until = cycle_end_date
  WHERE paid_until IS NULL AND status = 'active';

-- Create index for scheduled downgrades
CREATE INDEX IF NOT EXISTS idx_tenant_plans_downgrade_scheduled
  ON public.tenant_plans(downgrade_scheduled)
  WHERE downgrade_scheduled = true;

-- Create index for payment status queries
CREATE INDEX IF NOT EXISTS idx_tenant_plans_status_paid
  ON public.tenant_plans(status, paid_until);

-- Validation trigger: prevent invalid status transitions
CREATE OR REPLACE FUNCTION public.validate_subscription_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid boolean := false;
BEGIN
  -- Allow any transition from NULL (new row)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  CASE OLD.status
    WHEN 'trial' THEN
      valid := NEW.status IN ('active', 'cancelled');
    WHEN 'active' THEN
      valid := NEW.status IN ('past_due', 'suspended', 'cancelled');
    WHEN 'past_due' THEN
      valid := NEW.status IN ('active', 'suspended', 'cancelled');
    WHEN 'suspended' THEN
      valid := NEW.status IN ('active', 'cancelled');
    WHEN 'cancelled' THEN
      valid := false; -- terminal state
    ELSE
      valid := true;
  END CASE;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid subscription status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_subscription_status ON public.tenant_plans;
CREATE TRIGGER trg_validate_subscription_status
  BEFORE UPDATE OF status ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_subscription_status_transition();

-- Auto-set cancelled_at when status transitions to cancelled
CREATE OR REPLACE FUNCTION public.auto_set_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_cancelled_at ON public.tenant_plans;
CREATE TRIGGER trg_auto_cancelled_at
  BEFORE UPDATE OF status ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_cancelled_at();

-- Auto-set grace period on past_due (3 days grace)
CREATE OR REPLACE FUNCTION public.auto_set_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'past_due' AND OLD.status != 'past_due' THEN
    NEW.grace_period_ends_at := COALESCE(NEW.grace_period_ends_at, now() + interval '3 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_grace_period ON public.tenant_plans;
CREATE TRIGGER trg_auto_grace_period
  BEFORE UPDATE OF status ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_grace_period();
