// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocumentProofRegistry
 * @notice Stores immutable SHA-256 document hash proofs on-chain.
 *         No personal data is stored — only cryptographic hashes.
 *
 * @dev Deploy to Polygon/Ethereum. The backend edge function
 *      calls storeProof() after signature finalization.
 *
 * Usage:
 *   1. Frontend generates SHA-256 hash of signed document
 *   2. Edge function calls storeProof(hash)
 *   3. Contract emits ProofStored event with block.timestamp
 *   4. Anyone can call verifyProof(hash) to check existence
 */
contract DocumentProofRegistry {

    // ═══════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════

    /// @notice Maps document hash → block timestamp when it was anchored
    mapping(bytes32 => uint256) public proofs;

    /// @notice Contract owner (deployer)
    address public owner;

    // ═══════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════

    /// @notice Emitted when a new proof is stored
    event ProofStored(
        bytes32 indexed documentHash,
        uint256 timestamp,
        address indexed storedBy
    );

    // ═══════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
    }

    // ═══════════════════════════════════════════════════════
    // WRITE
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Store a document hash proof on-chain.
     * @param documentHash SHA-256 hash of the signed document (bytes32)
     * @dev Reverts if the hash was already stored (immutability guarantee).
     *      Only the contract owner can store proofs.
     */
    function storeProof(bytes32 documentHash) external onlyOwner {
        require(proofs[documentHash] == 0, "Proof already exists");
        proofs[documentHash] = block.timestamp;
        emit ProofStored(documentHash, block.timestamp, msg.sender);
    }

    // ═══════════════════════════════════════════════════════
    // READ
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Verify if a document hash has been anchored.
     * @param documentHash The hash to verify
     * @return timestamp The block timestamp when it was stored (0 if not found)
     */
    function verifyProof(bytes32 documentHash) external view returns (uint256 timestamp) {
        return proofs[documentHash];
    }

    /**
     * @notice Check if a proof exists for a given hash.
     * @param documentHash The hash to check
     * @return exists True if the proof was stored
     */
    function proofExists(bytes32 documentHash) external view returns (bool exists) {
        return proofs[documentHash] != 0;
    }
}
