
-- ══════════════════════════════════════════
-- Reference Letters Module
-- ══════════════════════════════════════════

CREATE TYPE public.reference_letter_status AS ENUM (
  'requested',
  'eligibility_denied',
  'pending_manager_signature',
  'pending_hr_signature',
  'signed',
  'delivered',
  'cancelled'
);

CREATE TABLE public.reference_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  
  -- Request info
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purpose TEXT,
  
  -- Eligibility
  is_eligible BOOLEAN NOT NULL DEFAULT false,
  eligibility_reason TEXT,
  eligibility_checked_at TIMESTAMPTZ,
  
  -- Letter content
  template_key TEXT NOT NULL DEFAULT 'standard',
  content_html TEXT,
  
  -- Dual signature flow
  status reference_letter_status NOT NULL DEFAULT 'requested',
  
  manager_signer_id UUID,
  manager_signed_at TIMESTAMPTZ,
  manager_signature_note TEXT,
  
  hr_signer_id UUID,
  hr_signed_at TIMESTAMPTZ,
  hr_signature_note TEXT,
  
  -- Delivery
  delivered_at TIMESTAMPTZ,
  delivered_to_email TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.reference_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for reference_letters"
ON public.reference_letters FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.platform_users WHERE id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_reference_letters_tenant ON public.reference_letters(tenant_id);
CREATE INDEX idx_reference_letters_employee ON public.reference_letters(employee_id);
CREATE INDEX idx_reference_letters_status ON public.reference_letters(status);

-- Timestamp trigger
CREATE TRIGGER update_reference_letters_updated_at
BEFORE UPDATE ON public.reference_letters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
