/**
 * Blockchain Hash Registry Engine — Bounded Context
 *
 * Registers SHA-256 hashes of signed documents on a public blockchain
 * to guarantee proof of integrity and existence.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │          Blockchain Hash Registry Engine                 │
 * ├─────────────────────────────────────────────────────────┤
 * │  blockchainRegistryService — anchor & verify hashes     │
 * │  blockchain-anchor (Edge)  — chain interaction          │
 * │  Immutable Registry        — no UPDATE/DELETE           │
 * └─────────────────────────────────────────────────────────┘
 *
 * Integrations:
 *   → Document Validation & LGPD Engine (hash source)
 *   → Legal Agreements Governance Engine (signed docs)
 *   → DocumentVault (document storage)
 *   → Security Kernel (tenant isolation via RLS)
 */

export { blockchainRegistryService } from './blockchain-registry.service';

export type {
  BlockchainProof,
  BlockchainProofStatus,
  AnchorDocumentDTO,
  AnchorResult,
  VerifyHashResult,
} from './types';
