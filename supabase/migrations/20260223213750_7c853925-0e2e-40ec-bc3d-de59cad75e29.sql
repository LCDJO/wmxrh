
CREATE TABLE public.blockchain_hash_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  signed_document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'simulated',
  tx_hash TEXT,
  block_number BIGINT,
  anchor_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  verification_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_blockchain_registry_tenant ON public.blockchain_hash_registry(tenant_id);
CREATE INDEX idx_blockchain_registry_document ON public.blockchain_hash_registry(signed_document_id);
CREATE INDEX idx_blockchain_registry_hash ON public.blockchain_hash_registry(document_hash);
CREATE INDEX idx_blockchain_registry_tx ON public.blockchain_hash_registry(tx_hash);

ALTER TABLE public.blockchain_hash_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view blockchain records"
  ON public.blockchain_hash_registry FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

CREATE POLICY "Tenant members can insert blockchain records"
  ON public.blockchain_hash_registry FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );
