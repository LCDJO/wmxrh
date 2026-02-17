-- Add applies_to field to coupons
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'invoice'
CHECK (applies_to IN ('plan', 'module', 'invoice'));

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_coupons_applies_to ON public.coupons (applies_to);
