import { NextResponse } from 'next/server';
import { getHealthSnapshot } from '@/lib/db';

export async function GET() {
    try {
        const health = await getHealthSnapshot();
        return NextResponse.json({
            status: health.ok ? 'healthy' : 'degraded',
            ...health,
        });
    } catch (error) {
        console.error('[API /health] Error:', error);
        return NextResponse.json(
            {
                status: 'degraded',
                ok: false,
                last_successful_sync_at: null,
                proposals_fetched_last_run: 0,
                summary_generation_failures_24h: 0,
                pending_batches: 0,
                submitted_batches: 0,
            },
            { status: 200 }
        );
    }
}
