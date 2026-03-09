import { NextResponse } from 'next/server';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ preferences: null });

    const preferences = await getUserPreferences(clientId);
    return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const clientId = body?.clientId as string | undefined;
        const preferences = body?.preferences;

        if (!clientId || !preferences) {
            return NextResponse.json({ error: 'clientId and preferences are required' }, { status: 400 });
        }

        const saved = await upsertUserPreferences(clientId, preferences);
        return NextResponse.json({ saved });
    } catch (error) {
        console.error('[API /preferences] Error:', error);
        return NextResponse.json({ saved: false }, { status: 200 });
    }
}
