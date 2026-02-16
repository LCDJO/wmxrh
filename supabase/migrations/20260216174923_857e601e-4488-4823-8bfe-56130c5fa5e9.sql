
-- ══════════════════════════════════════════════
-- EMPLOYEE AGREEMENT ENGINE — Schema
-- ══════════════════════════════════════════════

-- 1) Agreement Templates (master definitions)
CREATE TABLE public.agreement_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'position_specific', 'department_specific', 'onboarding', 'compliance', 'policy')),
  
  -- Scope: which positions/departments this applies to (null = all)
  applies_to_positions UUID[] DEFAULT '{}',
  applies_to_departments UUID[] DEFAULT '{}',
  
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_send_on_admission BOOLEAN NOT NULL DEFAULT false,
  
  -- Signing config
  requires_witness BOOLEAN NOT NULL DEFAULT false,
  expiry_days INTEGER, -- null = never expires
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, slug)
);

-- 2) Template Versions (immutable, append-only)
CREATE TABLE public.agreement_template_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.agreement_templates(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_plain TEXT,
  
  change_summary TEXT,
  published_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT false,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(template_id, version_number)
);

-- 3) Employee Agreements (individual signing records)
CREATE TABLE public.employee_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  template_id UUID NOT NULL REFERENCES public.agreement_templates(id),
  template_version_id UUID NOT NULL REFERENCES public.agreement_template_versions(id),
  
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'refused', 'expired', 'cancelled')),
  
  -- Signature provider tracking
  signature_provider TEXT, -- 'opensign', 'docusign', 'clicksign', 'manual', 'simulation'
  external_document_id TEXT, -- provider's document ID
  external_signing_url TEXT, -- URL sent to employee
  
  -- Signed document
  signed_document_url TEXT, -- storage path to signed PDF
  signed_document_hash TEXT, -- SHA-256 for integrity
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  refused_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Audit
  ip_address TEXT,
  user_agent TEXT,
  refusal_reason TEXT,
  sent_by UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════

CREATE INDEX idx_agreement_templates_tenant ON public.agreement_templates(tenant_id);
CREATE INDEX idx_agreement_templates_company ON public.agreement_templates(company_id);
CREATE INDEX idx_agreement_template_versions_template ON public.agreement_template_versions(template_id);
CREATE INDEX idx_employee_agreements_employee ON public.employee_agreements(employee_id);
CREATE INDEX idx_employee_agreements_status ON public.employee_agreements(status);
CREATE INDEX idx_employee_agreements_tenant ON public.employee_agreements(tenant_id);

-- ══════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════

ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_agreements ENABLE ROW LEVEL SECURITY;

-- Templates: users see their tenant's templates
CREATE POLICY "Users can view agreement templates in their tenant"
  ON public.agreement_templates FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage agreement templates"
  ON public.agreement_templates FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Template versions: same as templates
CREATE POLICY "Users can view template versions in their tenant"
  ON public.agreement_template_versions FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage template versions"
  ON public.agreement_template_versions FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Employee agreements: tenant-scoped
CREATE POLICY "Users can view employee agreements in their tenant"
  ON public.employee_agreements FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins and managers can manage employee agreements"
  ON public.employee_agreements FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
  ));

-- ══════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════

CREATE TRIGGER update_agreement_templates_updated_at
  BEFORE UPDATE ON public.agreement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_agreements_updated_at
  BEFORE UPDATE ON public.employee_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════
-- STORAGE: Signed documents bucket
-- ══════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) 
VALUES ('signed-documents', 'signed-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for signed documents
CREATE POLICY "Authenticated users can upload signed documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signed-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view signed documents in their tenant folder"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signed-documents' AND auth.uid() IS NOT NULL);
