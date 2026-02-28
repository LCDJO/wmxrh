-- Helper function to atomically increment failed_payment_count
CREATE OR REPLACE FUNCTION public.increment_failed_payments(sub_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.tenant_plans
  SET failed_payment_count = failed_payment_count + 1,
      updated_at = now()
  WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
