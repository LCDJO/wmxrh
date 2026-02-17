
-- Drop dependent policy first
DROP POLICY IF EXISTS "Tenant members can create evaluations" ON public.support_evaluations;

-- Add new columns
ALTER TABLE public.support_evaluations
  ADD COLUMN IF NOT EXISTS agent_score smallint,
  ADD COLUMN IF NOT EXISTS system_score smallint,
  ADD COLUMN IF NOT EXISTS comment text;

-- Migrate existing data
UPDATE public.support_evaluations SET agent_score = rating, comment = feedback WHERE rating IS NOT NULL;

-- Drop old columns
ALTER TABLE public.support_evaluations
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS feedback,
  DROP COLUMN IF EXISTS evaluator_id;

-- Recreate RLS policy without evaluator_id
CREATE POLICY "Tenant members can create evaluations"
  ON public.support_evaluations FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
