import { NextResponse } from 'next/server';
import { snapshotAdapter, fetchRecentProposals } from '@/lib/adapters/snapshot';
import { upsertProposal, getSummaryByProposalId, insertBatch, updateSummaryBatchId } from '@/lib/db';
import { analyzeProposal } from '@/lib/ai/router';
import { hashProposal, hashSummary } from '@daosense/shared';
import { insertSummary } from '@/lib/db';
import { buildBatch } from '@/lib/verification/batchBuilder';
import { submitBatchOnChain } from '@/lib/verification/submitter';

/**
 * GET /api/cron/fetch-proposals
 * Vercel Cron Job handler — runs every hour.
 * 1. Fetches active proposals from Snapshot (falls back to recent)
 * 2. Stores new proposals in DB
 * 3. Generates AI summaries for new proposals
 * 4. Builds Merkle batch if there are unbatched summaries
 */
export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const secretParam = url.searchParams.get('secret');

    const hasValidSecret =
        !cronSecret ||
        authHeader === `Bearer ${cronSecret}` ||
        secretParam === cronSecret;

    if (!hasValidSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
        fetched: 0,
        new: 0,
        summarized: 0,
        errors: [] as string[],
        batchBuilt: false,
    };

    try {
        // 1. Fetch active proposals; fall back to recent if none active
        console.log('[Cron] Fetching proposals from Snapshot...');
        let proposals = await snapshotAdapter.fetchActiveProposals();

        if (proposals.length === 0) {
            console.log('[Cron] No active proposals, fetching recent...');
            proposals = await fetchRecentProposals();
        }

        results.fetched = proposals.length;
        console.log(`[Cron] Found ${proposals.length} proposals`);

        // 2. Upsert each proposal and generate summaries for new ones
        for (const proposal of proposals) {
            try {
                await upsertProposal(proposal);

                const propHash = hashProposal(proposal.body);
                // Check if summary already exists and hasn't changed
                const existing = await getSummaryByProposalId(proposal.id);
                if (!existing || existing.hash_proposal !== propHash) {
                    if (!existing) results.new++;
                    else console.log(`[Cron] Proposal ${proposal.id} changed, regenerating summary...`);

                    // Generate AI summary
                    console.log(`[Cron] Generating summary for: ${proposal.title.slice(0, 60)}...`);
                    const result = await analyzeProposal(proposal.body, proposal.title);

                    const sumHash = hashSummary(result.response);

                    await insertSummary({
                        proposal_id: proposal.id,
                        summary_json: result.response,
                        hash_proposal: propHash,
                        hash_summary: sumHash,
                        overall_confidence: result.response.overall_confidence,
                    });

                    results.summarized++;
                }
            } catch (err) {
                const errorMsg = `Error processing ${proposal.id}: ${err}`;
                console.error(`[Cron] ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

        // 3. Build Merkle batch if there are unbatched summaries
        try {
            const batch = await buildBatch();
            if (batch) {
                results.batchBuilt = true;
                console.log(`[Cron] Batch prepared with ${batch.leafCount} leaves, root: ${batch.root}`);

                const hasOnChainConfig = Boolean(
                    process.env.DEPLOYER_PRIVATE_KEY &&
                    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS
                );

                if (hasOnChainConfig) {
                    await submitBatchOnChain(batch);
                    console.log('[Cron] Batch submitted on-chain and linked to summaries');
                } else {
                    // Persist the batch and link summaries even without contract deployment.
                    // This avoids summaries being stuck forever in "not batched yet".
                    const dbBatch = await insertBatch({
                        merkle_root: batch.root,
                        tx_hash: null,
                        chain_id: process.env.NODE_ENV === 'production' ? 43114 : 43113,
                        leaf_count: batch.leafCount,
                    });
                    await updateSummaryBatchId(batch.summaryIds, dbBatch.id);
                    console.log('[Cron] Batch linked in DB (pending on-chain submission)');
                }
            }
        } catch (err) {
            console.error('[Cron] Batch building error:', err);
            results.errors.push(`Batch error: ${err}`);
        }

        console.log('[Cron] Complete:', results);
        return NextResponse.json(results);
    } catch (error) {
        console.error('[Cron] Fatal error:', error);
        return NextResponse.json(
            { error: 'Cron job failed', details: String(error) },
            { status: 500 }
        );
    }
}
