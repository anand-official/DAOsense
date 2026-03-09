import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * GET /api/proposals/similar
 * Get a list of active proposals from the same space excluding the current one.
 * In a production V2, this would use pgvector cosine similarity.
 * For the MVP, we filter by `space` and random select to simulate context.
 */
export async function GET(request: Request) {
    try {
        if (!supabase) {
            return NextResponse.json({ proposals: [] });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const space = searchParams.get('space');
        const limit = parseInt(searchParams.get('limit') || '3');

        if (!id || !space) {
            return NextResponse.json({ proposals: [] });
        }

        const { data, error } = await supabase
            .from('proposals')
            .select('id, title, space, end_time')
            .eq('space', space)
            .neq('id', id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[API /proposals/similar] Supabase error:', error);
            throw error;
        }

        return NextResponse.json({ proposals: data || [] });
    } catch (error) {
        console.error('[API /proposals/similar] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch similar proposals' },
            { status: 500 }
        );
    }
}
