import type { Proposal } from './types';

/**
 * Adapter interface for fetching proposals from different sources.
 * Implement this interface to add new data sources (Snapshot, Governor contracts, etc.)
 */
export interface ProposalAdapter {
    /** Unique name identifying this adapter */
    readonly name: string;

    /** Fetch all currently active proposals */
    fetchActiveProposals(): Promise<Proposal[]>;

    /** Fetch a single proposal by its ID */
    fetchProposalById(id: string): Promise<Proposal | null>;
}
