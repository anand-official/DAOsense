import { NextResponse } from 'next/server';
import { getActiveProposals, getProposalById } from '@/lib/db';
import { snapshotAdapter, fetchRecentProposals } from '@/lib/adapters/snapshot';
import { upsertProposal } from '@/lib/db';

/**
 * GET /api/proposals
 * List active proposals with optional space filter.
 *
 * Query params:
 *   - space: filter by DAO space (e.g. "traderjoe-xyz")
 *   - id: get single proposal by ID
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const space = searchParams.get('space');
        const sync = searchParams.get('sync') === '1';

        if (id) {
            try {
                const proposal = await getProposalById(id);
                if (proposal) {
                    return NextResponse.json({ proposal, source: 'database' });
                }
            } catch (dbError) {
                console.warn('[API /proposals] DB lookup failed, trying Snapshot by id:', dbError);
            }

            const live = await snapshotAdapter.fetchProposalById(id);
            if (live) {
                try {
                    await upsertProposal(live);
                } catch (upsertError) {
                    console.error('[API /proposals] Upsert failed for fetched proposal', id, upsertError);
                }

                return NextResponse.json({
                    proposal: {
                        id: live.id,
                        space: live.space,
                        title: live.title,
                        body: live.body,
                        author: live.author,
                        start_time: live.start,
                        end_time: live.end,
                    },
                    source: 'snapshot',
                });
            }

            return NextResponse.json({ proposal: null }, { status: 404 });
        }

        try {
            let proposals = await getActiveProposals(space || undefined);

            if (sync || proposals.length === 0) {
                let live = await snapshotAdapter.fetchActiveProposals();
                if (live.length === 0) {
                    live = await fetchRecentProposals();
                }

                const upsertResults = await Promise.allSettled(
                    live.map((proposal) => upsertProposal(proposal))
                );

                upsertResults.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(
                            '[API /proposals] Upsert failed for',
                            live[index]?.id,
                            result.reason
                        );
                    }
                });

                // Use fresh DB view after sync; if DB is unavailable fallback below handles it.
                proposals = await getActiveProposals(space || undefined);
            }

            return NextResponse.json({ proposals, source: 'database' });
        } catch (dbError) {
            console.warn('[API /proposals] DB unavailable, falling back to Snapshot:', dbError);
            let live = await snapshotAdapter.fetchActiveProposals();
            if (live.length === 0) {
                live = await fetchRecentProposals();
            }

            const proposals = live
                .filter((p) => (space ? p.space === space : true))
                .map((p) => ({
                    id: p.id,
                    space: p.space,
                    title: p.title,
                    body: p.body,
                    author: p.author,
                    end_time: p.end,
                }));

            return NextResponse.json({ proposals, source: 'snapshot' });
        }
    } catch (error) {
        console.error('[API /proposals] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch proposals' },
            { status: 500 }
        );
    }
}
