
-- ══════════════════════════════════════════════════════════════
-- Automated Offboarding Workflow Engine — Database Schema
-- ══════════════════════════════════════════════════════════════

-- Enum for offboarding types
CREATE TYPE public.offboarding_type AS ENUM (
  'sem_justa_causa',
  'justa_causa',
  'pedido_demissao',
  'acordo_mutuo'
);

-- Enum for workflow status
CREATE TYPE public.offboarding_status AS ENUM (
  'draft',
  'in_progress',
  'pending_approval',
  'approved',
  'completed',
  'cancelled'
);

-- Enum for checklist item status
CREATE TYPE public.checklist_item_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'blocked'
);

-- ── Main Offboarding Workflows table ──
CREATE TABLE public.offboarding_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  
  -- Type & status
  offboarding_type public.offboarding_type NOT NULL,
  status public.offboarding_status NOT NULL DEFAULT 'draft',
  
  -- Key dates
  notification_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_date DATE NOT NULL,
  last_working_day DATE,
  
  -- Aviso prévio
  aviso_previo_type TEXT CHECK (aviso_previo_type IN ('trabalhado', 'indenizado', 'nao_aplicavel')) DEFAULT 'nao_aplicavel',
  aviso_previo_days INTEGER DEFAULT 0,
  
  -- Justa causa details
  justa_causa_motivo TEXT,
  justa_causa_artigo TEXT,
  
  -- Acordo mútuo details
  acordo_multa_fgts_pct NUMERIC(5,2) DEFAULT 0,
  
  -- Financial summary (from payroll simulation)
  rescisao_bruta NUMERIC(14,2) DEFAULT 0,
  rescisao_descontos NUMERIC(14,2) DEFAULT 0,
  rescisao_liquida NUMERIC(14,2) DEFAULT 0,
  simulation_snapshot JSONB,
  
  -- eSocial integration
  esocial_event_id TEXT,
  esocial_status TEXT DEFAULT 'pending',
  esocial_protocol TEXT,
  esocial_sent_at TIMESTAMPTZ,
  
  -- Reference letter
  reference_letter_eligible BOOLEAN DEFAULT false,
  reference_letter_approved BOOLEAN,
  reference_letter_approved_by UUID,
  reference_letter_generated_at TIMESTAMPTZ,
  reference_letter_document_id UUID,
  
  -- Archival
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  archive_snapshot JSONB,
  
  -- Metadata
  initiated_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Checklist Items ──
CREATE TABLE public.offboarding_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.offboarding_workflows(id) ON DELETE CASCADE,
  
  category TEXT NOT NULL CHECK (category IN (
    'documentacao', 'financeiro', 'esocial', 'patrimonio', 
    'acessos', 'beneficios', 'exame_demissional', 'arquivamento', 'comunicacao'
  )),
  title TEXT NOT NULL,
  description TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  
  status public.checklist_item_status NOT NULL DEFAULT 'pending',
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_automated BOOLEAN NOT NULL DEFAULT false,
  
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  skipped_reason TEXT,
  
  -- For automated items
  automation_action TEXT,
  automation_result JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Reference Letters ──
CREATE TABLE public.offboarding_reference_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.offboarding_workflows(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  
  -- Content
  content_html TEXT NOT NULL,
  content_plain TEXT,
  
  -- Eligibility assessment
  eligibility_score NUMERIC(5,2) DEFAULT 0,
  eligibility_criteria JSONB DEFAULT '{}',
  
  -- Approval
  approved BOOLEAN,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Signatures
  employee_signed BOOLEAN DEFAULT false,
  employee_signed_at TIMESTAMPTZ,
  employer_signed BOOLEAN DEFAULT false,
  employer_signed_at TIMESTAMPTZ,
  employer_signer_name TEXT,
  
  -- Document vault
  document_url TEXT,
  document_hash TEXT,
  blockchain_proof_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Offboarding Audit Log ──
CREATE TABLE public.offboarding_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.offboarding_workflows(id),
  action TEXT NOT NULL,
  actor_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX idx_offboarding_workflows_tenant ON public.offboarding_workflows(tenant_id);
CREATE INDEX idx_offboarding_workflows_employee ON public.offboarding_workflows(employee_id);
CREATE INDEX idx_offboarding_workflows_status ON public.offboarding_workflows(tenant_id, status);
CREATE INDEX idx_offboarding_checklist_workflow ON public.offboarding_checklist_items(workflow_id);
CREATE INDEX idx_offboarding_reference_workflow ON public.offboarding_reference_letters(workflow_id);
CREATE INDEX idx_offboarding_audit_workflow ON public.offboarding_audit_log(workflow_id);

-- ── RLS ──
ALTER TABLE public.offboarding_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_reference_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: tenant isolation via tenant_memberships
CREATE POLICY "Tenant members can view offboarding workflows"
  ON public.offboarding_workflows FOR SELECT
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can insert offboarding workflows"
  ON public.offboarding_workflows FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can update offboarding workflows"
  ON public.offboarding_workflows FOR UPDATE
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can view checklist items"
  ON public.offboarding_checklist_items FOR SELECT
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can manage checklist items"
  ON public.offboarding_checklist_items FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can view reference letters"
  ON public.offboarding_reference_letters FOR SELECT
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can manage reference letters"
  ON public.offboarding_reference_letters FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can view offboarding audit"
  ON public.offboarding_audit_log FOR SELECT
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant members can insert offboarding audit"
  ON public.offboarding_audit_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- Block UPDATE/DELETE on audit log (immutability)
CREATE POLICY "No updates on offboarding audit"
  ON public.offboarding_audit_log FOR UPDATE
  USING (false);

CREATE POLICY "No deletes on offboarding audit"
  ON public.offboarding_audit_log FOR DELETE
  USING (false);

-- ── Trigger for updated_at ──
CREATE TRIGGER update_offboarding_workflows_updated_at
  BEFORE UPDATE ON public.offboarding_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offboarding_checklist_updated_at
  BEFORE UPDATE ON public.offboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offboarding_reference_letters_updated_at
  BEFORE UPDATE ON public.offboarding_reference_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
