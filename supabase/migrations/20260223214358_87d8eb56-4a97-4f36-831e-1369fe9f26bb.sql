
-- Allow service_role to update pending blockchain proofs (webhook confirmation)
-- The blockchain-webhook edge function uses service_role_key
-- Only status transitions from 'pending' are allowed

CREATE POLICY "Service role can update pending proofs"
ON public.blockchain_hash_registry
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status IN ('confirmed', 'failed'));
