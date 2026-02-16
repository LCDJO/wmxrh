
-- Role inheritance table: allows Role A to inherit all permissions from Role B
CREATE TABLE public.role_inheritance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  child_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (parent_role_id, child_role_id, tenant_id),
  -- Prevent self-inheritance
  CONSTRAINT no_self_inherit CHECK (parent_role_id <> child_role_id)
);

-- Enable RLS
ALTER TABLE public.role_inheritance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view role inheritance"
  ON public.role_inheritance FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage role inheritance"
  ON public.role_inheritance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = role_inheritance.tenant_id
      AND tm.role IN ('superadmin', 'owner', 'admin', 'tenant_admin')
    )
  );

CREATE POLICY "Tenant admins can delete role inheritance"
  ON public.role_inheritance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = role_inheritance.tenant_id
      AND tm.role IN ('superadmin', 'owner', 'admin', 'tenant_admin')
    )
  );

-- Index for fast lookups
CREATE INDEX idx_role_inheritance_child ON public.role_inheritance(child_role_id);
CREATE INDEX idx_role_inheritance_parent ON public.role_inheritance(parent_role_id);
CREATE INDEX idx_role_inheritance_tenant ON public.role_inheritance(tenant_id);
