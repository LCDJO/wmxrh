
-- Add missing columns for appeal workflow decisions
ALTER TABLE public.enforcement_appeals
  ADD COLUMN IF NOT EXISTS decision_summary TEXT,
  ADD COLUMN IF NOT EXISTS escalated_to UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Add RLS policies if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enforcement_appeals' AND policyname = 'Platform ops can read all appeals') THEN
    CREATE POLICY "Platform ops can read all appeals"
      ON public.enforcement_appeals FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.platform_users pu
          WHERE pu.user_id = auth.uid()
            AND pu.role IN ('platform_super_admin', 'platform_operations')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enforcement_appeals' AND policyname = 'Platform ops can update appeals') THEN
    CREATE POLICY "Platform ops can update appeals"
      ON public.enforcement_appeals FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.platform_users pu
          WHERE pu.user_id = auth.uid()
            AND pu.role IN ('platform_super_admin', 'platform_operations')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enforcement_appeals' AND policyname = 'Tenant users can submit appeals') THEN
    CREATE POLICY "Tenant users can submit appeals"
      ON public.enforcement_appeals FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.tenant_memberships tm
          WHERE tm.user_id = auth.uid()
            AND tm.tenant_id = enforcement_appeals.tenant_id
            AND tm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enforcement_appeals' AND policyname = 'Tenant users can read own appeals') THEN
    CREATE POLICY "Tenant users can read own appeals"
      ON public.enforcement_appeals FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.tenant_memberships tm
          WHERE tm.user_id = auth.uid()
            AND tm.tenant_id = enforcement_appeals.tenant_id
            AND tm.status = 'active'
        )
      );
  END IF;
END $$;

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_enforcement_appeals_status ON public.enforcement_appeals(status);
CREATE INDEX IF NOT EXISTS idx_enforcement_appeals_enforcement_id ON public.enforcement_appeals(enforcement_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_appeals_tenant_id ON public.enforcement_appeals(tenant_id);
