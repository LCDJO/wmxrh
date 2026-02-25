
DROP POLICY IF EXISTS "Tenant users can view their enforcement zones" ON public.fleet_enforcement_zones;
DROP POLICY IF EXISTS "Tenant users can insert enforcement zones" ON public.fleet_enforcement_zones;
DROP POLICY IF EXISTS "Tenant users can update their enforcement zones" ON public.fleet_enforcement_zones;
DROP POLICY IF EXISTS "Tenant users can delete their enforcement zones" ON public.fleet_enforcement_zones;

CREATE POLICY "Tenant users can view their enforcement zones"
ON public.fleet_enforcement_zones FOR SELECT
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Tenant users can insert enforcement zones"
ON public.fleet_enforcement_zones FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Tenant users can update their enforcement zones"
ON public.fleet_enforcement_zones FOR UPDATE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Tenant users can delete their enforcement zones"
ON public.fleet_enforcement_zones FOR DELETE
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);
