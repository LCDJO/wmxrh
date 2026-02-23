
-- Async blockchain anchor queue with retry support
-- SECURITY: Only hashes are stored — NEVER document content or PII

CREATE TABLE public.blockchain_anchor_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  signed_document_id UUID NOT NULL,
  hash_sha256 TEXT NOT NULL,
  created_by UUID,
  
  -- Queue state
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter')),
  
  -- Retry tracking
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  
  -- Result (filled on completion)
  proof_id UUID REFERENCES public.blockchain_hash_registry(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blockchain_anchor_queue ENABLE ROW LEVEL SECURITY;

-- Tenant members can insert (enqueue) and read their own queue items
CREATE POLICY "Tenant members can enqueue anchors"
ON public.blockchain_anchor_queue
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_memberships.tenant_id = blockchain_anchor_queue.tenant_id
    AND tenant_memberships.user_id = auth.uid()
    AND tenant_memberships.status = 'active'
  )
);

CREATE POLICY "Tenant members can view their queue"
ON public.blockchain_anchor_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_memberships.tenant_id = blockchain_anchor_queue.tenant_id
    AND tenant_memberships.user_id = auth.uid()
    AND tenant_memberships.status = 'active'
  )
);

-- Service role can update queue items (processor uses service_role_key)
CREATE POLICY "Service role updates queue"
ON public.blockchain_anchor_queue
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Indexes for queue processing
CREATE INDEX idx_blockchain_queue_pending ON public.blockchain_anchor_queue (status, next_retry_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX idx_blockchain_queue_tenant ON public.blockchain_anchor_queue (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_blockchain_anchor_queue_updated_at
  BEFORE UPDATE ON public.blockchain_anchor_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
