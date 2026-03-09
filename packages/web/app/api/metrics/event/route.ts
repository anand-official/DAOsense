import { NextResponse } from 'next/server';
import { trackMetricEvent } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const eventName = body?.event_name as string | undefined;
        const clientId = body?.client_id as string | undefined;
        const payload = body?.payload as Record<string, unknown> | undefined;

        if (!eventName || !clientId) {
            return NextResponse.json({ ok: false, error: 'event_name and client_id required' }, { status: 400 });
        }

        await trackMetricEvent({
            event_name: eventName,
            client_id: clientId,
            payload,
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[API /metrics/event] Error:', error);
        return NextResponse.json({ ok: true });
    }
}
