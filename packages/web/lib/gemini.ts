import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Get a Gemini model instance configured for JSON output.
 * Uses Gemini 2.0 Flash (free tier: 1,500 req/day).
 */
export function getGeminiModel() {
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3, // Low temp for consistent, factual output
            maxOutputTokens: 4096,
        },
    });
}

/**
 * Get a Gemini model instance for chain-of-thought analysis.
 * Same model but with higher token limits and structured thinking.
 */
export function getGeminiModelEnhanced() {
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2, // Even lower for complex analysis
            maxOutputTokens: 8192,
        },
    });
}

import { getRecentSummariesCount } from './db';

const MAX_REQUESTS_PER_DAY = 1400; // 100 buffer below 1500 limit

export async function checkRateLimit(): Promise<boolean> {
    try {
        const count = await getRecentSummariesCount();
        if (count >= MAX_REQUESTS_PER_DAY) {
            return false; // Rate limited
        }
        return true;
    } catch (error) {
        console.error('[RateLimit] Failed to check rate limit:', error);
        // Fail-open or close? Safe to fail-open for now, but log error
        return true;
    }
}
