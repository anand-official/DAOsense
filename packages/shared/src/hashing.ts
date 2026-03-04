import { sha256 } from 'js-sha256';
import type { SummaryResult } from './types';

/**
 * Canonically normalize proposal text before hashing.
 * Ensures identical proposals always produce the same hash.
 */
function canonicalize(text: string): string {
    return text
        .trim()
        .replace(/\r\n/g, '\n')     // normalize line endings
        .replace(/\s+/g, ' ')        // collapse whitespace
        .toLowerCase();
}

/**
 * Hash a proposal body using SHA-256 after canonical normalization.
 */
export function hashProposal(body: string): string {
    const canonical = canonicalize(body);
    return sha256(canonical);
}

/**
 * Hash a summary result using SHA-256.
 * Keys are sorted deterministically to ensure consistent hashing.
 */
export function hashSummary(summary: SummaryResult): string {
    const sorted = JSON.stringify(summary, Object.keys(summary).sort());
    return sha256(sorted);
}

/**
 * Compute a Merkle leaf from proposal hash and summary hash.
 * Uses keccak256(proposalHash + summaryHash) for EVM compatibility.
 */
export function computeLeaf(proposalHash: string, summaryHash: string): Buffer {
    const keccak256 = require('keccak256');
    const combined = Buffer.concat([
        Buffer.from(proposalHash, 'hex'),
        Buffer.from(summaryHash, 'hex'),
    ]);
    return keccak256(combined);
}
