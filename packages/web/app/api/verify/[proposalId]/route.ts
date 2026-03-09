import { NextResponse } from 'next/server';
import { getSummaryByProposalId, getBatchById } from '@/lib/db';
import { computeLeaf } from '@daosense/shared';

/**
 * GET /api/verify/[proposalId]
 * Get verification proof data for a proposal and optionally verify on-chain.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ proposalId: string }> }
) {
    try {
        const { proposalId } = await params;

        // Get the summary
        const summary = await getSummaryByProposalId(proposalId);
        if (!summary) {
            return NextResponse.json(
                { error: 'Summary not found', verified: false },
                { status: 404 }
            );
        }

        if (!summary.batch_id) {
            return NextResponse.json({
                verified: false,
                status: 'pending',
                verification_stage: 'not_batched',
                message: 'Summary has not been batched yet. It will be included in the next batch.',
                proposalId,
                hashes: {
                    proposal: summary.hash_proposal,
                    summary: summary.hash_summary,
                },
            });
        }

        // Get the batch
        const batch = await getBatchById(summary.batch_id);
        if (!batch) {
            return NextResponse.json(
                { error: 'Batch not found', verified: false },
                { status: 500 }
            );
        }

        // Compute the leaf
        const leaf = computeLeaf(summary.hash_proposal, summary.hash_summary);
        const leafHex = '0x' + leaf.toString('hex');

        const contractAddress = process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS;
        const chainId = batch.chain_id;
        const explorerUrl =
            chainId === 43114
                ? `https://snowtrace.io/tx/${batch.tx_hash}`
                : `https://testnet.snowtrace.io/tx/${batch.tx_hash}`;

        if (!batch.tx_hash) {
            const hasPrivateKey = Boolean(process.env.DEPLOYER_PRIVATE_KEY);
            const hasContractAddress = Boolean(process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS);
            const missingConfig: string[] = [];
            if (!hasPrivateKey) missingConfig.push('DEPLOYER_PRIVATE_KEY');
            if (!hasContractAddress) missingConfig.push('NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS');

            return NextResponse.json({
                verified: false,
                status: 'pending',
                verification_stage: 'batched_db',
                proposalId,
                batch_id: batch.id,
                merkle_root: batch.merkle_root,
                leaf: leafHex,
                contract_address: contractAddress,
                chain_id: chainId,
                message: missingConfig.length
                    ? `Summary is batched in DB. On-chain submission is not configured (missing: ${missingConfig.join(', ')}).`
                    : 'Summary is batched in DB and waiting for on-chain submission.',
                can_submit_on_chain: missingConfig.length === 0,
                missing_config: missingConfig,
                hashes: {
                    proposal: summary.hash_proposal,
                    summary: summary.hash_summary,
                },
            });
        }

        return NextResponse.json({
            verified: true,
            status: 'verified',
            verification_stage: 'on_chain_verified',
            proposalId,
            batch_id: batch.id,
            merkle_root: batch.merkle_root,
            leaf: leafHex,
            tx_hash: batch.tx_hash,
            contract_address: contractAddress,
            chain_id: chainId,
            explorer_url: explorerUrl,
            hashes: {
                proposal: summary.hash_proposal,
                summary: summary.hash_summary,
            },
        });
    } catch (error) {
        console.error('[API /verify] Error:', error);
        return NextResponse.json(
            { error: 'Verification failed', verified: false },
            { status: 500 }
        );
    }
}
