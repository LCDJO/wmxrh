
-- Add tenant_id as alternative owner for referral links
ALTER TABLE public.referral_links
  ADD COLUMN owner_tenant_id UUID REFERENCES public.tenants(id);

-- Tenant members can view their tenant's referral links
CREATE POLICY "tenant_members_view_referral_links" ON public.referral_links FOR SELECT TO authenticated
  USING (owner_tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_referral_links_tenant ON public.referral_links(owner_tenant_id);
