
-- ═══════════════════════════════════════════════════════
-- Landing Page Governance Workflow Tables
-- ═══════════════════════════════════════════════════════

-- Approval requests for landing page lifecycle
CREATE TABLE public.landing_page_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  
  -- Workflow state: draft → pending_review → approved → published | rejected
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'published', 'cancelled')),
  
  -- Who submitted
  submitted_by TEXT NOT NULL,          -- platform_user email
  submitted_by_user_id UUID NOT NULL,  -- auth.uid of submitter
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submission_notes TEXT,
  
  -- Review decision
  reviewed_by TEXT,                    -- platform_user email of reviewer
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT CHECK (review_decision IN ('approved', 'rejected')),
  review_notes TEXT,
  
  -- Publication
  published_by TEXT,
  published_by_user_id UUID,
  published_at TIMESTAMPTZ,
  
  -- Snapshot of landing page content at submission time for audit
  page_snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Version tracking
  version_number INT NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_page_approval_requests ENABLE ROW LEVEL SECURITY;

-- Only platform users can access
CREATE POLICY "Platform users can view approval requests"
ON public.landing_page_approval_requests
FOR SELECT
USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert approval requests"
ON public.landing_page_approval_requests
FOR INSERT
WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update approval requests"
ON public.landing_page_approval_requests
FOR UPDATE
USING (public.is_active_platform_user(auth.uid()));

-- Audit log for every state transition
CREATE TABLE public.landing_page_governance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.landing_page_approval_requests(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'published', 'cancelled', 'revision_requested')),
  performed_by TEXT NOT NULL,
  performed_by_user_id UUID NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_governance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view governance logs"
ON public.landing_page_governance_logs
FOR SELECT
USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert governance logs"
ON public.landing_page_governance_logs
FOR INSERT
WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_landing_page_approval_updated_at
BEFORE UPDATE ON public.landing_page_approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_lp_approval_page_id ON public.landing_page_approval_requests(landing_page_id);
CREATE INDEX idx_lp_approval_status ON public.landing_page_approval_requests(status);
CREATE INDEX idx_lp_governance_log_request ON public.landing_page_governance_logs(approval_request_id);
