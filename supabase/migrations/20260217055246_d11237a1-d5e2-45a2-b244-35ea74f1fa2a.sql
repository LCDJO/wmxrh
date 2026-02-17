-- Add restriction columns to coupons
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS allowed_modules text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS allowed_payment_methods text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tenant_scope uuid DEFAULT NULL;

-- Index for tenant-scoped coupons
CREATE INDEX IF NOT EXISTS idx_coupons_tenant_scope ON public.coupons (tenant_scope) WHERE tenant_scope IS NOT NULL;
