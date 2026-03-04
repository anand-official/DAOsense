// ===== DAOSense Core Types =====

/** Supported data sources for proposals */
export type ProposalSource = 'snapshot' | 'onchain' | 'manual';

/** Confidence level for AI-generated fields */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** Risk categories for DAO proposals */
export type RiskType = 'financial' | 'technical' | 'governance' | 'legal';

/** Raw proposal fetched from a data source */
export interface Proposal {
    id: string;
    space: string;
    title: string;
    body: string;
    author: string;
    start: number;
    end: number;
    source: ProposalSource;
    state?: string;
}

/** A key point extracted from a proposal with source citation */
export interface KeyPoint {
    text: string;
    source_snippet: string;
}

/** A risk identified in a proposal */
export interface Risk {
    risk_type: RiskType;
    description: string;
    confidence: ConfidenceLevel;
}

/** Financial impact assessment */
export interface FinancialImpact {
    amount: string;
    token: string;
    confidence: ConfidenceLevel;
}

/** Complete AI-generated summary result */
export interface SummaryResult {
    summary: string[];
    key_points: KeyPoint[];
    risks: Risk[];
    financial_impact: FinancialImpact | null;
    overall_confidence: number; // 0-1 scale
}

/** Database record for a stored summary */
export interface SummaryRecord {
    id: string;
    proposal_id: string;
    summary_json: SummaryResult;
    hash_proposal: string;
    hash_summary: string;
    overall_confidence: number;
    batch_id: string | null;
    created_at: string;
}

/** Merkle batch record for on-chain verification */
export interface BatchRecord {
    id: string;
    merkle_root: string;
    tx_hash: string | null;
    chain_id: number;
    leaf_count: number;
    created_at: string;
}

/** Verification proof data returned to clients */
export interface VerificationProof {
    batch_id: string;
    proof: string[];
    leaf: string;
    merkle_root: string;
    contract_address: string;
    verified: boolean;
}

/** AI routing decision */
export interface AIRoutingDecision {
    model: string;
    strategy: 'simple' | 'chain-of-thought';
    response: SummaryResult;
}
