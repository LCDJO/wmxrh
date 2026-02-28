-- Add grace_period_days to saas_plans (configurable per plan)
ALTER TABLE public.saas_plans
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

-- Add auto_invoice_number and overdue tracking to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

-- Create index for billing cycle queries
CREATE INDEX IF NOT EXISTS idx_invoices_status_due
  ON public.invoices(status, due_date)
  WHERE status IN ('pending', 'overdue');

-- Create index for tenant billing lookups  
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_period
  ON public.invoices(tenant_id, billing_period_start);

-- Set grace periods per plan tier
UPDATE public.saas_plans SET grace_period_days = 0 WHERE name = 'Free';
UPDATE public.saas_plans SET grace_period_days = 5 WHERE name = 'Basic';
UPDATE public.saas_plans SET grace_period_days = 7 WHERE name = 'Pro';
UPDATE public.saas_plans SET grace_period_days = 10 WHERE name = 'Enterprise';

-- Function to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || to_char(now(), 'YYYYMM') || '-' || substring(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_invoice_number ON public.invoices;
CREATE TRIGGER trg_auto_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invoice_number();

-- Function: when invoice is paid, update tenant_plans.paid_until and last_payment_at
CREATE OR REPLACE FUNCTION public.on_invoice_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
    
    -- Update subscription paid_until and reset failed payment count
    UPDATE public.tenant_plans
    SET 
      paid_until = NEW.billing_period_end::timestamptz,
      last_payment_at = now(),
      failed_payment_count = 0,
      status = CASE 
        WHEN status IN ('past_due', 'suspended') THEN 'active'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.subscription_id
      AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_on_invoice_paid ON public.invoices;
CREATE TRIGGER trg_on_invoice_paid
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_paid();
