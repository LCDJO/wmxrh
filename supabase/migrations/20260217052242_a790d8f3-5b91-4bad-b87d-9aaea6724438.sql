
-- Add missing columns to tenant_plans
ALTER TABLE public.tenant_plans
ADD COLUMN next_billing_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN payment_method TEXT DEFAULT NULL CHECK (payment_method IN ('pix','boleto','credit_card','bank_transfer','manual', NULL));

COMMENT ON COLUMN public.tenant_plans.next_billing_date IS 'Next billing date for this tenant plan';
COMMENT ON COLUMN public.tenant_plans.payment_method IS 'Preferred payment method for this tenant';
