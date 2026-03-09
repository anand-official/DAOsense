// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ProposalVerifier
 * @notice Stores Merkle roots of batched proposal+summary hashes for trustless verification.
 * @dev Uses MerkleProof.verifyCalldata for ~30% gas savings over memory-based verify.
 *      Designed for Avalanche C-Chain with post-Octane sub-penny batch costs.
 */
contract ProposalVerifier is Ownable, Pausable {
    struct Batch {
        bytes32 merkleRoot;
        uint256 timestamp;
        uint256 leafCount;
    }

    /// @notice All submitted batches, indexed sequentially
    mapping(uint256 => Batch) public batches;

    /// @notice Total number of batches submitted
    uint256 public batchCount;

    /// @notice Emitted when a new batch is submitted
    event BatchSubmitted(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint256 leafCount,
        uint256 timestamp
    );

    /// @notice Emitted when a batch is revoked
    event BatchRevoked(uint256 indexed batchId);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Pause verification in case of an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause verification.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Submit a new Merkle root for a batch of proposal+summary hash pairs.
     * @param _root The Merkle root of the batch.
     * @param _leafCount Number of leaves (proposal+summary pairs) in this batch.
     */
    function submitBatch(bytes32 _root, uint256 _leafCount) external onlyOwner {
        require(_root != bytes32(0), "Empty root");
        require(_leafCount > 0, "Empty batch");

        batches[batchCount] = Batch({
            merkleRoot: _root,
            timestamp: block.timestamp,
            leafCount: _leafCount
        });

        emit BatchSubmitted(batchCount, _root, _leafCount, block.timestamp);
        batchCount++;
    }

    /**
     * @notice Verify that a leaf (proposal+summary hash) is part of a submitted batch.
     * @param _batchId The batch to verify against.
     * @param _proof The Merkle proof path.
     * @param _leaf The leaf hash to verify.
     * @return True if the proof is valid.
     */
    function verifyProof(
        uint256 _batchId,
        bytes32[] calldata _proof,
        bytes32 _leaf
    ) external view whenNotPaused returns (bool) {
        require(_batchId < batchCount, "Batch does not exist");
        return MerkleProof.verifyCalldata(
            _proof,
            batches[_batchId].merkleRoot,
            _leaf
        );
    }

    /**
     * @notice Get batch details.
     * @param _batchId The batch ID to query.
     * @return merkleRoot The Merkle root of the batch.
     * @return timestamp When the batch was submitted.
     * @return leafCount Number of leaves in the batch.
     */
    function getBatch(uint256 _batchId)
        external
        view
        returns (bytes32 merkleRoot, uint256 timestamp, uint256 leafCount)
    {
        require(_batchId < batchCount, "Batch does not exist");
        Batch memory batch = batches[_batchId];
        return (batch.merkleRoot, batch.timestamp, batch.leafCount);
    }

    /**
     * @notice Revoke a batch by setting its root to zero, to nullify any proofs.
     * @param _batchId The ID of the batch to revoke.
     */
    function revokeBatch(uint256 _batchId) external onlyOwner {
        require(_batchId < batchCount, "Batch does not exist");
        require(batches[_batchId].merkleRoot != bytes32(0), "Batch already revoked");
        
        batches[_batchId].merkleRoot = bytes32(0);
        emit BatchRevoked(_batchId);
    }
}
