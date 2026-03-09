import { computeLeaf, buildMerkleTree, getMerkleRoot, getMerkleProof } from '@daosense/shared';
import { getUnbatchedSummaries, getSummaryByProposalId } from '../db';

export interface BatchData {
    root: string;
    leafCount: number;
    leaves: Buffer[];
    proofs: Map<string, string[]>; // summaryId -> proof
    summaryIds: string[];
}

/**
 * Build a Merkle batch from all unbatched summaries.
 * Each leaf = keccak256(SHA256(proposal) + SHA256(summary))
 */
export async function buildBatch(): Promise<BatchData | null> {
    const unbatched = await getUnbatchedSummaries();

    if (unbatched.length === 0) {
        console.log('[BatchBuilder] No unbatched summaries found');
        return null;
    }

    console.log(`[BatchBuilder] Building batch with ${unbatched.length} summaries`);

    const leaves: Buffer[] = [];
    const summaryIds: string[] = [];

    for (const row of unbatched) {
        const leaf = computeLeaf(row.hash_proposal, row.hash_summary);
        leaves.push(leaf);
        summaryIds.push(row.id);
    }

    const tree = buildMerkleTree(leaves);
    const root = getMerkleRoot(tree);

    // Generate proofs for each leaf
    const proofs = new Map<string, string[]>();
    for (let i = 0; i < leaves.length; i++) {
        const proof = getMerkleProof(tree, leaves[i]);
        proofs.set(summaryIds[i], proof);
    }

    return {
        root,
        leafCount: leaves.length,
        leaves,
        proofs,
        summaryIds,
    };
}

/**
 * Get the Merkle proof for a specific proposal's summary.
 * Reconstructs the tree from the batch's summaries.
 */
export async function getProofForProposal(
    proposalId: string
): Promise<{ proof: string[]; leaf: string } | null> {
    const summary = await getSummaryByProposalId(proposalId);
    if (!summary || !summary.batch_id) return null;

    // Reconstruct the tree from all summaries in this batch
    // In production, proofs would be cached in DB
    // This is a simplified version - in production, we'd query all summaries for the batch
    return null;
}
