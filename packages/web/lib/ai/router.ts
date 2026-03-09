import type { SummaryResult, AIRoutingDecision } from '@daosense/shared';
import { getGeminiModel, getGeminiModelEnhanced, checkRateLimit } from '../gemini';
import { SIMPLE_PROMPT, CHAIN_OF_THOUGHT_PROMPT } from './prompts';
import { computeOverallConfidence } from './confidence';

/** Keywords that indicate a complex proposal */
const COMPLEX_KEYWORDS = [
    'treasury',
    'upgrade',
    'migration',
    'fork',
    'emergency',
    'smart contract',
    'protocol',
    'liquidity',
    'collateral',
    'oracle',
];

/**
 * Determine whether a proposal needs complex (chain-of-thought) analysis.
 */
function isComplexProposal(body: string): boolean {
    if (body.length > 5000) return true;

    const lowerBody = body.toLowerCase();
    const hasComplexKeywords = COMPLEX_KEYWORDS.some((kw) => lowerBody.includes(kw));
    if (hasComplexKeywords) return true;

    // Check for code blocks
    if (body.includes('```') || body.includes('function ') || body.includes('contract '))
        return true;

    return false;
}

/**
 * Parse JSON response from Gemini, handling edge cases.
 */
function parseSummaryResponse(text: string): SummaryResult {
    // Gemini with JSON mode should return clean JSON, but handle markdown wrapping
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validate and normalize the response
    return {
        summary: Array.isArray(parsed.summary) ? parsed.summary : [],
        key_points: Array.isArray(parsed.key_points)
            ? parsed.key_points.map((kp: { text?: string; source_snippet?: string }) => ({
                text: kp.text || '',
                source_snippet: kp.source_snippet || '',
            }))
            : [],
        risks: Array.isArray(parsed.risks)
            ? parsed.risks.map((r: { risk_type?: string; description?: string; confidence?: string }) => ({
                risk_type: r.risk_type || 'governance',
                description: r.description || '',
                confidence: r.confidence || 'medium',
            }))
            : [],
        proposal_type: parsed.proposal_type || 'other',
        financial_impact: parsed.financial_impact
            ? {
                amount: parsed.financial_impact.amount || '0',
                token: parsed.financial_impact.token || 'unknown',
                confidence: parsed.financial_impact.confidence || 'low',
            }
            : null,
        decision_card: {
            vote_recommendation: parsed.decision_card?.vote_recommendation || 'abstain',
            rationale: Array.isArray(parsed.decision_card?.rationale)
                ? parsed.decision_card.rationale.slice(0, 2)
                : ['Insufficient structured signal for clear recommendation.', 'Review key points and risks manually before voting.'],
            risk_level: parsed.decision_card?.risk_level || 'medium',
            risk_confidence: parsed.decision_card?.risk_confidence || 'medium',
            expected_change: parsed.decision_card?.expected_change || 'No clear expected change was identified.',
        },
        overall_confidence: 0, // Will be computed by confidence scorer
    };
}

/**
 * Route a proposal through the tiered Gemini AI pipeline.
 *
 * Flow:
 * 1. Classify proposal as simple or complex
 * 2. Run appropriate prompt strategy
 * 3. Compute confidence score
 * 4. If confidence < 0.7, re-run with enhanced chain-of-thought
 * 5. If Gemini fails, generate a basic text-extraction fallback
 * 6. Return final result
 */

/**
 * Generate a basic fallback summary by extracting text patterns.
 * Used when Gemini API is unavailable.
 */
function generateFallbackSummary(body: string, title: string): SummaryResult {
    const sentences = body
        .replace(/\n+/g, '. ')
        .split(/\.\s+/)
        .filter((s) => s.trim().length > 20)
        .slice(0, 5)
        .map((s) => s.trim().replace(/\.$/, ''));

    // Extract financial figures
    const financialMatch = body.match(/\$[\d,.]+[MBK]?|\d+[\d,.]*\s*(?:AVAX|JOE|QI|PNG|USDC|USDT|BTC|ETH)/i);

    return {
        summary: sentences.length > 0 ? sentences : [title],
        key_points: [
            {
                text: title,
                source_snippet: body.slice(0, 150).trim(),
            },
        ],
        risks: [
            {
                risk_type: 'governance',
                description: 'AI analysis unavailable — manual review recommended',
                confidence: 'low',
            },
        ],
        proposal_type: 'other',
        financial_impact: financialMatch
            ? { amount: financialMatch[0], token: 'UNKNOWN', confidence: 'low' }
            : null,
        decision_card: {
            vote_recommendation: 'abstain',
            rationale: [
                'AI quota or model error triggered fallback extraction mode.',
                'Use source snippets and risks for manual voting judgment.',
            ],
            risk_level: 'medium',
            risk_confidence: 'low',
            expected_change: 'Potential governance impact detected, but confidence is limited in fallback mode.',
        },
        overall_confidence: 0.35,
    };
}

export async function analyzeProposal(
    proposalBody: string,
    proposalTitle: string
): Promise<AIRoutingDecision> {
    if (!(await checkRateLimit())) {
        throw new Error('Gemini API rate limit reached (1,400/day). Try again tomorrow.');
    }

    const isComplex = isComplexProposal(proposalBody);
    const fullText = `Title: ${proposalTitle}\n\n${proposalBody}`;

    // First pass
    let strategy: 'simple' | 'chain-of-thought' = isComplex ? 'chain-of-thought' : 'simple';
    const prompt = isComplex ? CHAIN_OF_THOUGHT_PROMPT : SIMPLE_PROMPT;
    let model = isComplex ? getGeminiModelEnhanced() : getGeminiModel();

    console.log(`[AI Router] Analyzing proposal: "${proposalTitle.slice(0, 60)}..." (strategy: ${strategy})`);

    try {
        let result = await model.generateContent(prompt + fullText);
        let responseText = result.response.text();
        let summary = parseSummaryResponse(responseText);
        let confidence = computeOverallConfidence(summary, proposalBody);
        summary.overall_confidence = confidence;

        console.log(`[AI Router] First pass confidence: ${confidence}`);

        // Fallback: re-run with enhanced prompt if confidence is low
        if (confidence < 0.7 && strategy === 'simple') {
            console.log(`[AI Router] Low confidence, re-running with chain-of-thought...`);

            if (!(await checkRateLimit())) {
                return { model: 'gemini-2.0-flash', strategy, response: summary };
            }

            strategy = 'chain-of-thought';
            model = getGeminiModelEnhanced();
            result = await model.generateContent(CHAIN_OF_THOUGHT_PROMPT + fullText);
            responseText = result.response.text();
            summary = parseSummaryResponse(responseText);
            confidence = computeOverallConfidence(summary, proposalBody);
            summary.overall_confidence = confidence;

            console.log(`[AI Router] Second pass confidence: ${confidence}`);
        }

        return {
            model: 'gemini-2.0-flash',
            strategy,
            response: summary,
        };
    } catch (error) {
        console.error(`[AI Router] Gemini API failed, using text-extraction fallback:`, error);

        const fallback = generateFallbackSummary(proposalBody, proposalTitle);

        return {
            model: 'fallback-text-extraction',
            strategy: 'simple',
            response: fallback,
        };
    }
}

