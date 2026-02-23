
-- Rename columns to match BlockchainProof entity spec
ALTER TABLE public.blockchain_hash_registry
  RENAME COLUMN document_hash TO hash_sha256;

ALTER TABLE public.blockchain_hash_registry
  RENAME COLUMN chain TO blockchain_network;

ALTER TABLE public.blockchain_hash_registry
  RENAME COLUMN tx_hash TO transaction_hash;

ALTER TABLE public.blockchain_hash_registry
  RENAME COLUMN anchor_timestamp TO timestamp_blockchain;

-- Update status values: 'anchored' → 'confirmed'
UPDATE public.blockchain_hash_registry SET status = 'confirmed' WHERE status = 'anchored';
