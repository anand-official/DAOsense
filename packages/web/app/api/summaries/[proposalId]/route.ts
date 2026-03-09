import { NextResponse } from 'next/server';
import { getSummaryByProposalId, getProposalById } from '@/lib/db';
import { analyzeProposal } from '@/lib/ai/router';
import { hashProposal, hashSummary } from '@daosense/shared';
import { insertSummary } from '@/lib/db';

/**
 * GET /api/summaries/[proposalId]
 * Get the AI summary for a specific proposal.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ proposalId: string }> }
) {
    try {
        const { proposalId } = await params;
        let summary = await getSummaryByProposalId(proposalId);

        if (!summary) {
            // Lazy-generate summary on first read to reduce visible 404s in UI.
            const proposal = await getProposalById(proposalId);
            if (!proposal) {
                return NextResponse.json(
                    { error: 'Summary not found', proposalId },
                    { status: 404 }
                );
            }

            const result = await analyzeProposal(proposal.body, proposal.title);
            const propHash = hashProposal(proposal.body);
            const sumHash = hashSummary(result.response);

            summary = await insertSummary({
                proposal_id: proposalId,
                summary_json: result.response,
                hash_proposal: propHash,
                hash_summary: sumHash,
                overall_confidence: result.response.overall_confidence,
            });

            return NextResponse.json({ summary, generated: true });
        }

        return NextResponse.json({ summary, generated: false });
    } catch (error) {
        console.error('[API /summaries] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch summary' },
            { status: 500 }
        );
    }
}

const inflightRequests = new Set<string>();

/**
 * POST /api/summaries/[proposalId]
 * Generate a new AI summary for a proposal.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ proposalId: string }> }
) {
    let locked = false;
    let proposalId = '';
    try {
        const paramsResolved = await params;
        proposalId = paramsResolved.proposalId;

        // Fetch the proposal
        const proposal = await getProposalById(proposalId);
        if (!proposal) {
            return NextResponse.json(
                { error: 'Proposal not found' },
                { status: 404 }
            );
        }

        // Check for existing summary
        let existing = await getSummaryByProposalId(proposalId);
        if (existing) {
            return NextResponse.json({
                summary: existing,
                message: 'Summary already exists',
                cached: true,
            });
        }

        if (inflightRequests.has(proposalId)) {
            return NextResponse.json(
                { error: 'Summary generation already in progress' },
                { status: 409 }
            );
        }

        inflightRequests.add(proposalId);
        locked = true;

        // Double check after acquiring lock (handle race between DB check and lock acquisition)
        existing = await getSummaryByProposalId(proposalId);
        if (existing) {
            return NextResponse.json({
                summary: existing,
                message: 'Summary already exists',
                cached: true,
            });
        }

        // Generate AI summary
        console.log(`[API] Generating summary for proposal: ${proposal.title}`);
        const result = await analyzeProposal(proposal.body, proposal.title);

        // Compute hashes for verification
        const propHash = hashProposal(proposal.body);
        const sumHash = hashSummary(result.response);

        // Store in DB
        const saved = await insertSummary({
            proposal_id: proposalId,
            summary_json: result.response,
            hash_proposal: propHash,
            hash_summary: sumHash,
            overall_confidence: result.response.overall_confidence,
        });

        return NextResponse.json({
            summary: saved,
            ai: {
                model: result.model,
                strategy: result.strategy,
            },
            cached: false,
        });
    } catch (error) {
        console.error('[API /summaries] Generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        );
    } finally {
        if (locked) {
            inflightRequests.delete(proposalId);
        }
    }
}
