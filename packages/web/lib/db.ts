import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasServerConfig = Boolean(supabaseUrl && supabaseServiceKey);
const hasPublicConfig = Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));

/**
 * Supabase client for server-side operations (API routes, cron jobs).
 * Uses the service role key for full access.
 */
export const supabase = hasServerConfig
    ? createClient(supabaseUrl as string, supabaseServiceKey as string)
    : null;

/**
 * Supabase client for client-side operations.
 * Uses the anon key (public) for read-only access.
 */
export const supabasePublic = hasPublicConfig
    ? createClient(supabaseUrl as string, (supabaseAnonKey || supabaseServiceKey) as string)
    : null;

function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    return supabase;
}

// ===== Typed Query Helpers =====

import type { Proposal, SummaryResult } from '@daosense/shared';

/** Database row types */
export interface ProposalRow {
    id: string;
    space: string;
    title: string;
    body: string;
    author: string | null;
    start_time: number | null;
    end_time: number | null;
    raw_content: string;
    source: string;
    created_at: string;
}

export interface SummaryRow {
    id: string;
    proposal_id: string;
    summary_json: SummaryResult;
    hash_proposal: string;
    hash_summary: string;
    overall_confidence: number | null;
    batch_id: string | null;
    created_at: string;
}

export interface BatchRow {
    id: string;
    merkle_root: string;
    tx_hash: string | null;
    chain_id: number;
    leaf_count: number | null;
    created_at: string;
}

export interface HealthSnapshot {
    ok: boolean;
    last_successful_sync_at: string | null;
    proposals_fetched_last_run: number;
    summary_generation_failures_24h: number;
    pending_batches: number;
    submitted_batches: number;
}

// ===== Proposal Queries =====

export async function getActiveProposals(space?: string) {
    const db = requireSupabase();
    let query = db
        .from('proposals')
        .select('*')
        .order('end_time', { ascending: false });

    if (space) {
        query = query.eq('space', space);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ProposalRow[];
}

export async function getProposalById(id: string) {
    const db = requireSupabase();
    const { data, error } = await db
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as ProposalRow) || null;
}

export async function upsertProposal(proposal: Proposal) {
    const db = requireSupabase();
    const { error } = await db.from('proposals').upsert({
        id: proposal.id,
        space: proposal.space,
        title: proposal.title,
        body: proposal.body,
        author: proposal.author,
        start_time: proposal.start,
        end_time: proposal.end,
        raw_content: proposal.body,
        source: proposal.source,
    });
    if (error) throw error;
}

// ===== Summary Queries =====

export async function getSummaryByProposalId(proposalId: string) {
    const db = requireSupabase();
    const { data, error } = await db
        .from('summaries')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data as SummaryRow | null;
}

export async function insertSummary(summary: {
    proposal_id: string;
    summary_json: SummaryResult;
    hash_proposal: string;
    hash_summary: string;
    overall_confidence: number;
}) {
    const db = requireSupabase();
    const { data, error } = await db
        .from('summaries')
        .insert(summary)
        .select()
        .single();

    if (error) throw error;
    return data as SummaryRow;
}

export async function getRecentSummariesCount(): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const db = requireSupabase();
    const { count, error } = await db
        .from('summaries')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

    if (error) throw error;
    return count || 0;
}

export async function getUnbatchedSummaries() {
    const db = requireSupabase();
    const { data, error } = await db
        .from('summaries')
        .select('*')
        .is('batch_id', null);

    if (error) throw error;
    return data as SummaryRow[];
}

export async function updateSummaryBatchId(summaryIds: string[], batchId: string) {
    const db = requireSupabase();
    const { error } = await db
        .from('summaries')
        .update({ batch_id: batchId })
        .in('id', summaryIds);

    if (error) throw error;
}

// ===== Batch Queries =====

export async function insertBatch(batch: {
    merkle_root: string;
    tx_hash: string | null;
    chain_id: number;
    leaf_count: number;
}) {
    const db = requireSupabase();
    const { data, error } = await db
        .from('batches')
        .insert(batch)
        .select()
        .single();

    if (error) throw error;
    return data as BatchRow;
}

export async function getBatchById(batchId: string) {
    const db = requireSupabase();
    const { data, error } = await db
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

    if (error) throw error;
    return data as BatchRow;
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
    if (!supabase) {
        return {
            ok: false,
            last_successful_sync_at: null,
            proposals_fetched_last_run: 0,
            summary_generation_failures_24h: 0,
            pending_batches: 0,
            submitted_batches: 0,
        };
    }

    const db = requireSupabase();

    const [latestProposal, latestBatch, proposalCount, pendingBatches, submittedBatches] =
        await Promise.all([
            db.from('proposals').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
            db.from('batches').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
            db.from('proposals').select('*', { count: 'exact', head: true }),
            db.from('batches').select('*', { count: 'exact', head: true }).is('tx_hash', null),
            db.from('batches').select('*', { count: 'exact', head: true }).not('tx_hash', 'is', null),
        ]);

    const lastSync = latestBatch.data?.created_at || latestProposal.data?.created_at || null;
    const summaryFailures = 0;

    return {
        ok: true,
        last_successful_sync_at: lastSync,
        proposals_fetched_last_run: proposalCount.count || 0,
        summary_generation_failures_24h: summaryFailures,
        pending_batches: pendingBatches.count || 0,
        submitted_batches: submittedBatches.count || 0,
    };
}

export interface WatchlistPreferences {
    spaces: string[];
    proposal_types: string[];
    risk_threshold: 'low' | 'medium' | 'high';
}

export async function getUserPreferences(clientId: string): Promise<WatchlistPreferences | null> {
    if (!supabase) return null;
    const db = requireSupabase();
    const { data, error } = await db
        .from('user_preferences')
        .select('watchlist_spaces,watchlist_types,risk_threshold')
        .eq('client_id', clientId)
        .maybeSingle();

    if (error) return null;
    if (!data) return null;
    return {
        spaces: data.watchlist_spaces || [],
        proposal_types: data.watchlist_types || [],
        risk_threshold: data.risk_threshold || 'medium',
    };
}

export async function upsertUserPreferences(clientId: string, prefs: WatchlistPreferences): Promise<boolean> {
    if (!supabase) return false;
    const db = requireSupabase();
    const { error } = await db.from('user_preferences').upsert({
        client_id: clientId,
        watchlist_spaces: prefs.spaces,
        watchlist_types: prefs.proposal_types,
        risk_threshold: prefs.risk_threshold,
        updated_at: new Date().toISOString(),
    });
    return !error;
}

export async function trackMetricEvent(event: {
    event_name: string;
    client_id: string;
    payload?: Record<string, unknown>;
}): Promise<void> {
    if (!supabase) return;
    const db = requireSupabase();
    await db.from('metrics_events').insert({
        event_name: event.event_name,
        client_id: event.client_id,
        payload: event.payload || {},
    });
}
