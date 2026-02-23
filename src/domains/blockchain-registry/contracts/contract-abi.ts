/**
 * Smart Contract Integration — Reference & ABI
 *
 * This file contains the ABI and deployment reference for the
 * DocumentProofRegistry Solidity contract. When deployed to
 * Polygon/Ethereum, update CONTRACT_ADDRESS and the edge function
 * will use ethers.js to interact with the contract.
 *
 * Contract: src/domains/blockchain-registry/contracts/DocumentProofRegistry.sol
 */

/** Replace with actual deployed contract address */
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Polygon Mainnet / Amoy Testnet */
export const SUPPORTED_NETWORKS = {
  polygon_mainnet: {
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
  },
  polygon_amoy: {
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
  },
} as const;

/** Minimal ABI for DocumentProofRegistry */
export const DOCUMENT_PROOF_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'storeProof',
    inputs: [{ name: 'documentHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verifyProof',
    inputs: [{ name: 'documentHash', type: 'bytes32' }],
    outputs: [{ name: 'timestamp', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proofExists',
    inputs: [{ name: 'documentHash', type: 'bytes32' }],
    outputs: [{ name: 'exists', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proofs',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ProofStored',
    inputs: [
      { name: 'documentHash', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'storedBy', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Convert a hex SHA-256 hash string to bytes32 format.
 * The contract expects bytes32 — a 0x-prefixed 64-char hex string.
 */
export function hashToBytes32(sha256Hex: string): string {
  const clean = sha256Hex.replace(/^0x/, '');
  if (clean.length !== 64) {
    throw new Error(`Invalid SHA-256 hash length: expected 64 hex chars, got ${clean.length}`);
  }
  return `0x${clean}`;
}
