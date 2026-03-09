import type { SummaryResult } from '@daosense/shared';

/**
 * Validate and score AI-generated summaries for accuracy.
 */

/**
 * Check if a source snippet actually exists in the proposal text.
 * Uses fuzzy matching to handle minor whitespace/formatting differences.
 */
function snippetExists(snippet: string, proposalBody: string): boolean {
    // Normalize both for comparison
    const normalizedSnippet = snippet.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedBody = proposalBody.trim().toLowerCase().replace(/\s+/g, ' ');

    // Exact containment
    if (normalizedBody.includes(normalizedSnippet)) return true;

    // Fuzzy: check if 80% of words in snippet appear in similar order in body
    const snippetWords = normalizedSnippet.split(' ').filter((w) => w.length > 3);
    if (snippetWords.length === 0) return false;

    let foundCount = 0;
    for (const word of snippetWords) {
        if (normalizedBody.includes(word)) foundCount++;
    }

    return foundCount / snippetWords.length >= 0.8;
}

/**
 * Compute citation accuracy: what fraction of source_snippets actually appear in the proposal.
 */
function computeCitationAccuracy(
    summary: SummaryResult,
    proposalBody: string
): number {
    const allSnippets = summary.key_points.map((kp) => kp.source_snippet);
    if (allSnippets.length === 0) return 0.5; // No citations = neutral

    let validCount = 0;
    for (const snippet of allSnippets) {
        if (snippetExists(snippet, proposalBody)) validCount++;
    }

    return validCount / allSnippets.length;
}

/**
 * Map confidence level string to numeric value.
 */
function confidenceToNumber(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
        case 'high':
            return 1.0;
        case 'medium':
            return 0.7;
        case 'low':
            return 0.4;
        default:
            return 0.5;
    }
}

/**
 * Compute overall confidence score (0-1) for a summary.
 * Combines:
 * - Citation accuracy (40% weight): do source snippets actually exist in proposal?
 * - Risk confidence (20% weight): average confidence of risk assessments
 * - Content completeness (20% weight): presence of summary, key points, risks
 * - Financial accuracy (20% weight): financial impact confidence if present
 */
export function computeOverallConfidence(
    summary: SummaryResult,
    proposalBody: string
): number {
    // 1. Citation accuracy (40%)
    const citationScore = computeCitationAccuracy(summary, proposalBody);

    // 2. Risk confidence average (20%)
    let riskScore = 0.7; // default if no risks
    if (summary.risks.length > 0) {
        const riskConfidences = summary.risks.map((r) => confidenceToNumber(r.confidence));
        riskScore = riskConfidences.reduce((a, b) => a + b, 0) / riskConfidences.length;
    }

    // 3. Content completeness (20%)
    let completeness = 0;
    if (summary.summary.length >= 3) completeness += 0.4;
    else if (summary.summary.length >= 1) completeness += 0.2;
    if (summary.key_points.length >= 2) completeness += 0.3;
    else if (summary.key_points.length >= 1) completeness += 0.15;
    if (summary.risks.length >= 1) completeness += 0.3;

    // 4. Financial accuracy (20%)
    let financialScore = 0.7; // default if no financial impact
    if (summary.financial_impact) {
        financialScore = confidenceToNumber(summary.financial_impact.confidence);
    }

    const overall =
        citationScore * 0.4 +
        riskScore * 0.2 +
        completeness * 0.2 +
        financialScore * 0.2;

    return Math.round(overall * 100) / 100; // Round to 2 decimal places
}

/**
 * Check if a summary needs a low-confidence warning.
 */
export function needsWarning(confidence: number): boolean {
    return confidence < 0.6;
}
