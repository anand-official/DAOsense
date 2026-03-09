import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * GET /api/summaries/bulk
 * Get summaries for a list of proposal IDs
 */
export async function GET(request: Request) {
    try {
        if (!supabase) {
            return NextResponse.json({ summaries: [] });
        }

        const { searchParams } = new URL(request.url);
        const idsParams = searchParams.get('ids');

        if (!idsParams) {
            return NextResponse.json({ summaries: [] });
        }

        const ids = idsParams.split(',');

        const { data, error } = await supabase
            .from('summaries')
            .select('*')
            .in('proposal_id', ids);

        if (error) {
            console.error('[API /summaries/bulk] Supabase error:', error);
            throw error;
        }

        return NextResponse.json({ summaries: data || [] });
    } catch (error) {
        console.error('[API /summaries/bulk] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bulk summaries' },
            { status: 500 }
        );
    }
}
