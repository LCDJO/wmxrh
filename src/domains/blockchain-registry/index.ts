/**
 * Blockchain Hash Registry Engine — Bounded Context
 *
 * Registers SHA-256 hashes of signed documents on a public blockchain
 * to guarantee proof of integrity and existence.
 *
 * SECURITY GUARANTEES:
 *   ✓ NEVER sends document content to blockchain — only SHA-256 hash
 *   ✓ Async queue with exponential backoff retry (30s → 2h)
 *   ✓ Dead-letter after 5 failed attempts
 *   ✓ No PII stored on-chain or in queue
 *   ✓ Tenant isolation via RLS
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │          Blockchain Hash Registry Engine                 │
 * ├─────────────────────────────────────────────────────────┤
 * │  executeBlockchainRegistration — enqueue hash-only job   │
 * │  blockchain-queue-processor    — async retry engine      │
 * │  blockchain-anchor (Edge)      — chain interaction       │
 * │  blockchain-webhook (Edge)     — async confirmation      │
 * │  Immutable Registry            — no UPDATE/DELETE        │
 * └─────────────────────────────────────────────────────────┘
 */

export { blockchainRegistryService } from './blockchain-registry.service';
export {
  executeBlockchainRegistration,
  registerPrecomputedHash,
  getQueueStatus,
} from './blockchain-registration-flow';

export type {
  BlockchainProof,
  BlockchainProofStatus,
  AnchorDocumentDTO,
  AnchorResult,
  VerifyHashResult,
} from './types';

export type {
  RegistrationFlowInput,
  RegistrationFlowResult,
} from './blockchain-registration-flow';
