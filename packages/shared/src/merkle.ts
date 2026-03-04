import { MerkleTree } from 'merkletreejs';
const keccak256 = require('keccak256');

/**
 * Build a Merkle tree from an array of leaf buffers.
 * Uses keccak256 as the hash function for EVM compatibility.
 */
export function buildMerkleTree(leaves: Buffer[]): MerkleTree {
    return new MerkleTree(leaves, keccak256, {
        sortPairs: true, // deterministic ordering
    });
}

/**
 * Get the Merkle root as a hex string (with 0x prefix).
 */
export function getMerkleRoot(tree: MerkleTree): string {
    return '0x' + tree.getRoot().toString('hex');
}

/**
 * Get the Merkle proof for a specific leaf.
 * Returns an array of hex strings (with 0x prefix) suitable for on-chain verification.
 */
export function getMerkleProof(tree: MerkleTree, leaf: Buffer): string[] {
    return tree.getProof(leaf).map((p) => '0x' + p.data.toString('hex'));
}

/**
 * Verify a leaf against a Merkle root using its proof.
 * Client-side verification before sending to contract.
 */
export function verifyMerkleProof(
    leaf: Buffer,
    proof: string[],
    root: string
): boolean {
    const proofBuffers = proof.map((p) => Buffer.from(p.slice(2), 'hex'));
    const rootBuffer = Buffer.from(root.slice(2), 'hex');
    const tree = new MerkleTree([], keccak256, { sortPairs: true });
    return tree.verify(proofBuffers, leaf, rootBuffer);
}
