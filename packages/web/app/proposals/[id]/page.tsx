'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

import type { SummaryResult, ProposalType } from '@daosense/shared';

interface ProposalDetail {
    id: string;
    space: string;
    title: string;
    body: string;
    author: string | null;
    start_time: number | null;
    end_time: number | null;
}

interface SimilarProposal {
    id: string;
    title: string;
    space: string;
    end_time: number | null;
}

// Demo data for offline/demo mode
const DEMO_DETAIL: Record<string, { proposal: ProposalDetail; summary: SummaryResult }> = {
    'demo-1': {
        proposal: {
            id: 'demo-1', space: 'traderjoe-xyz',
            title: 'TJP-47: Increase sJOE Staking Rewards by 15% for Q2 2026',
            body: 'This proposal aims to increase the sJOE staking rewards allocation from the current 10% to 15% of protocol revenue. The current staking APR of 8.2% has been declining, and this change would boost it to approximately 12.3%. Expected to attract 2M additional JOE tokens to staking, increasing TVL by $4.8M. The increase will be funded by redirecting fees from the unused Rocket Joe launchpad allocation.',
            author: '0x742d...6aB2', start_time: Math.floor(Date.now() / 1000) - 86400, end_time: Math.floor(Date.now() / 1000) + 86400 * 3,
        },
        summary: {
            summary: [
                'Increase sJOE staking rewards from 10% to 15% of protocol revenue',
                'Expected to boost staking APR from 8.2% to ~12.3%',
                'Projected to attract 2M additional JOE tokens to staking',
                'Funded by redirecting unused Rocket Joe launchpad fees',
            ],
            key_points: [
                { text: 'Revenue allocation change from 10% to 15%', source_snippet: 'increase the sJOE staking rewards allocation from the current 10% to 15% of protocol revenue' },
                { text: 'Significant APR improvement projected', source_snippet: 'current staking APR of 8.2% has been declining, and this change would boost it to approximately 12.3%' },
                { text: 'Substantial TVL growth expected', source_snippet: 'attract 2M additional JOE tokens to staking, increasing TVL by $4.8M' },
            ],
            risks: [
                { risk_type: 'financial', description: 'Reduced revenue allocation to other protocol areas', confidence: 'medium' },
                { risk_type: 'governance', description: 'Sets precedent for future reward increases', confidence: 'low' },
            ],
            proposal_type: 'parameter_update',
            financial_impact: { amount: '$4.8M TVL increase', token: 'JOE', confidence: 'medium' },
            decision_card: {
                vote_recommendation: 'for',
                rationale: [
                    'Proposal increases staking participation with explicit funding source.',
                    'Main tradeoff is treasury allocation flexibility, but risks are manageable.',
                ],
                risk_level: 'medium',
                risk_confidence: 'medium',
                expected_change: 'Higher staking APR and likely increase in staked JOE TVL.',
            },
            overall_confidence: 0.92,
        } as SummaryResult,
    },
    'demo-2': {
        proposal: {
            id: 'demo-2', space: 'benqi-finance',
            title: 'BIP-23: Add wBTC.b as Collateral with 65% LTV on Benqi',
            body: 'Proposal to add Wrapped Bitcoin (wBTC.b) bridged via BTC.b as an accepted collateral asset on Benqi lending protocol with a 65% loan-to-value ratio. Initial supply cap of $5M with plans to increase based on liquidity depth. Oracle pricing via Chainlink BTC/USD feed with 1-hour heartbeat.',
            author: '0x1a2b...3c4d', start_time: Math.floor(Date.now() / 1000) - 86400, end_time: Math.floor(Date.now() / 1000) + 86400 * 5,
        },
        summary: {
            summary: [
                'Add wBTC.b as collateral on Benqi with 65% LTV ratio',
                'Initial supply cap of $5M with planned increases',
                'Chainlink BTC/USD oracle for reliable price feeds',
                'Expands Bitcoin utility within Avalanche DeFi ecosystem',
            ],
            key_points: [
                { text: 'Conservative LTV ratio for Bitcoin collateral', source_snippet: 'accepted collateral asset on Benqi lending protocol with a 65% loan-to-value ratio' },
                { text: 'Supply cap as risk management measure', source_snippet: 'Initial supply cap of $5M with plans to increase based on liquidity depth' },
            ],
            risks: [
                { risk_type: 'technical', description: 'Bridge dependency (BTC.b) introduces cross-chain risk', confidence: 'high' },
                { risk_type: 'financial', description: 'Bitcoin volatility may trigger liquidations at 65% LTV', confidence: 'medium' },
            ],
            proposal_type: 'parameter_update',
            financial_impact: { amount: '$5M initial cap', token: 'wBTC.b', confidence: 'high' },
            decision_card: {
                vote_recommendation: 'abstain',
                rationale: [
                    'Collateral expansion is valuable but bridge risk is material.',
                    'Vote depends on risk appetite and available oracle/monitoring safeguards.',
                ],
                risk_level: 'high',
                risk_confidence: 'medium',
                expected_change: 'Adds BTC collateral utility with initial market-size limits.',
            },
            overall_confidence: 0.87,
        } as SummaryResult,
    },
};

function getTypeLabel(type: ProposalType | undefined): string {
    if (!type || type === 'other') return 'Discussion';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
}

function getRiskIcon(type: string): string {
    switch (type) {
        case 'financial': return '💰';
        case 'technical': return '⚙️';
        case 'governance': return '🏛️';
        case 'legal': return '⚖️';
        default: return '⚠️';
    }
}

function computeEvidenceStatus(snippet: string, body: string): 'supported' | 'weak' {
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedSnippet = normalize(snippet);
    const normalizedBody = normalize(body);

    if (!normalizedSnippet) return 'weak';
    if (normalizedBody.includes(normalizedSnippet)) return 'supported';

    const words = normalizedSnippet.split(' ').filter((word) => word.length > 3);
    if (words.length === 0) return 'weak';
    const hits = words.filter((word) => normalizedBody.includes(word)).length;
    return hits / words.length >= 0.8 ? 'supported' : 'weak';
}

export default function ProposalDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [summary, setSummary] = useState<SummaryResult | null>(null);
    const [similarProposals, setSimilarProposals] = useState<SimilarProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState<{
        status: string;
        verification_stage?: 'not_batched' | 'batched_db' | 'submitted_on_chain' | 'on_chain_verified';
        message?: string;
        explorer_url?: string;
    } | null>(null);
    const [openedAt, setOpenedAt] = useState<number>(Date.now());

    async function trackEvent(eventName: string, payload?: Record<string, unknown>) {
        if (typeof window === 'undefined') return;
        const clientId = localStorage.getItem('daosense_client_id') || 'anonymous';
        await fetch('/api/metrics/event', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event_name: eventName, client_id: clientId, payload }),
        });
    }

    useEffect(() => {
        setOpenedAt(Date.now());
        async function loadData() {
            // Check if demo
            if (DEMO_DETAIL[id]) {
                setProposal(DEMO_DETAIL[id].proposal);
                setSummary(DEMO_DETAIL[id].summary);
                setLoading(false);
                trackEvent('proposal_detail_opened', { proposal_id: id, mode: 'demo' });
                return;
            }

            try {
                // Fetch proposal
                const propRes = await fetch(`/api/proposals?id=${id}`);
                const propData = await propRes.json();
                setProposal(propData.proposal);

                // Fetch summary
                const sumRes = await fetch(`/api/summaries/${id}`);
                if (sumRes.ok) {
                    const sumData = await sumRes.json();
                    setSummary(sumData.summary?.summary_json);
                }

                // Fetch similar context
                if (propData.proposal?.space) {
                    const simRes = await fetch(`/api/proposals/similar?id=${id}&space=${propData.proposal.space}&limit=3`);
                    if (simRes.ok) {
                        const simData = await simRes.json();
                        setSimilarProposals(simData.proposals || []);
                    }
                }
            } catch (error) {
                console.error('Error loading proposal:', error);
            } finally {
                setLoading(false);
                trackEvent('proposal_detail_opened', { proposal_id: id, mode: 'live' });
            }
        }
        loadData();
    }, [id]);

    async function handleVerify() {
        setVerifying(true);
        try {
            const res = await fetch(`/api/verify/${id}`);
            const data = await res.json();
            setVerifyResult(data);
            trackEvent('verify_clicked', {
                proposal_id: id,
                verification_stage: data?.verification_stage || 'unknown',
                time_to_first_action_ms: Date.now() - openedAt,
            });
        } catch {
            setVerifyResult({ status: 'failed', message: 'Verification request failed' });
        } finally {
            setVerifying(false);
        }
    }

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="loading">
                    <div className="spinner" />
                    <span style={{ color: 'var(--text-muted)' }}>Loading proposal...</span>
                </div>
            </>
        );
    }

    if (!proposal) {
        return (
            <>
                <Navbar />
                <div className="empty-state">
                    <h3>Proposal not found</h3>
                    <p>The proposal you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="detail-container animate-in">
                <button className="back-btn" onClick={() => router.push('/')}>
                    ← Back to proposals
                </button>

                <div className="detail-header">
                    <div className="detail-meta" style={{ marginBottom: '0.75rem' }}>
                        <span className={`space-badge ${proposal.space.includes('traderjoe') ? 'traderjoe' : proposal.space.includes('benqi') ? 'benqi' : 'pangolin'}`}>
                            ◆ {proposal.space}
                        </span>
                        {summary?.proposal_type && (
                            <span className="px-3 py-1 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                                {getTypeLabel(summary.proposal_type)}
                            </span>
                        )}
                        {summary && (
                            <span className={`confidence-indicator ${getConfidenceLevel(summary.overall_confidence)}`}>
                                {Math.round(summary.overall_confidence * 100)}% confidence
                            </span>
                        )}
                    </div>
                    <h1 className="detail-title">{proposal.title}</h1>
                    <div className="detail-meta">
                        <span className="detail-meta-item">👤 {proposal.author || 'Unknown'}</span>
                        {proposal.end_time && (
                            <span className="detail-meta-item">
                                ⏱ Ends {new Date(proposal.end_time * 1000).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Low confidence warning */}
                {summary && summary.overall_confidence < 0.6 && (
                    <div className="warning-banner">
                        ⚠️ Low confidence summary — AI analysis may contain inaccuracies
                        <button className="report-btn">Report Issue</button>
                    </div>
                )}

                {/* Summary */}
                {summary ? (
                    <>
                        <div className="summary-section">
                            <h3 className="summary-section-title">📋 Summary</h3>
                            <ul className="summary-bullets">
                                {summary.summary.map((point, i) => (
                                    <li key={i}>{point}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Key Points */}
                        {summary.key_points.length > 0 && (
                            <div className="summary-section">
                                <h3 className="summary-section-title">🔑 Key Points</h3>
                                {summary.key_points.map((kp, i) => (
                                    <div className="key-point" key={i}>
                                        {(() => {
                                            const evidence = computeEvidenceStatus(kp.source_snippet, proposal.body);
                                            return (
                                                <div
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        marginBottom: '0.4rem',
                                                        color: evidence === 'supported' ? 'var(--accent-green)' : 'var(--accent-yellow)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                    }}
                                                >
                                                    Evidence: {evidence}
                                                </div>
                                            );
                                        })()}
                                        <div className="kp-text">{kp.text}</div>
                                        <div className="kp-source">&quot;{kp.source_snippet}&quot;</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Decision Card */}
                        <div className="summary-section">
                            <h3 className="summary-section-title">🧭 Decision Card</h3>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div className="detail-meta-item">
                                    <strong style={{ color: 'var(--text-primary)' }}>Recommendation:</strong>{' '}
                                    <span style={{ textTransform: 'uppercase' }}>
                                        {summary.decision_card?.vote_recommendation || 'abstain'}
                                    </span>
                                </div>
                                <div className="detail-meta-item">
                                    <strong style={{ color: 'var(--text-primary)' }}>Risk:</strong>{' '}
                                    {(summary.decision_card?.risk_level || 'medium')} ({summary.decision_card?.risk_confidence || 'medium'} confidence)
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {(summary.decision_card?.rationale || []).map((line, idx) => (
                                        <div key={idx}>- {line}</div>
                                    ))}
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>Expected change:</strong>{' '}
                                    {summary.decision_card?.expected_change || 'No clear expected change identified.'}
                                </div>
                            </div>
                        </div>

                        {/* Risks */}
                        {summary.risks.length > 0 && (
                            <div className="summary-section">
                                <h3 className="summary-section-title">⚠️ Identified Risks</h3>
                                {summary.risks.map((risk, i) => (
                                    <div className={`risk-card ${risk.risk_type}`} key={i}>
                                        <span className="risk-icon">{getRiskIcon(risk.risk_type)}</span>
                                        <div>
                                            <div className="risk-type" style={{ color: 'var(--text-muted)' }}>
                                                {risk.risk_type} · {risk.confidence} confidence
                                            </div>
                                            <div className="risk-desc">{risk.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Financial Impact */}
                        {summary.financial_impact && (
                            <div className="summary-section">
                                <h3 className="summary-section-title">💰 Financial Impact</h3>
                                <div className="financial-impact">
                                    <div>
                                        <div className="financial-amount">{summary.financial_impact.amount}</div>
                                        <div className="financial-token">{summary.financial_impact.token} · {summary.financial_impact.confidence} confidence</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Verification */}
                        <div className="summary-section">
                            <h3 className="summary-section-title">🔗 On-Chain Verification</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Verify this summary&apos;s integrity on the Avalanche blockchain. The AI analysis and proposal text are hashed and stored in a Merkle tree on-chain.
                            </p>
                            <button
                                className={`verify-btn ${verifyResult?.status === 'verified' ? 'verified' : ''}`}
                                onClick={handleVerify}
                                disabled={verifying}
                            >
                                {verifying ? (
                                    <>
                                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                        Verifying...
                                    </>
                                ) : verifyResult?.status === 'verified' ? (
                                    '✓ Verified on Avalanche'
                                ) : (
                                    '◆ Verify on Avalanche'
                                )}
                            </button>
                            {verifyResult && (
                                <>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                                        <span className={`confidence-indicator ${verifyResult.verification_stage === 'batched_db' ? 'medium' : 'low'}`}>
                                            1/3 Batched (DB)
                                        </span>
                                        <span className={`confidence-indicator ${verifyResult.verification_stage === 'submitted_on_chain' || verifyResult.status === 'verified' ? 'high' : 'low'}`}>
                                            2/3 Submitted on-chain
                                        </span>
                                        <span className={`confidence-indicator ${verifyResult.status === 'verified' ? 'high' : 'low'}`}>
                                            3/3 On-chain verified
                                        </span>
                                    </div>
                                    <div className={`verify-result ${verifyResult.status === 'verified' ? 'success' : verifyResult.status === 'pending' ? 'pending' : 'failed'}`}>
                                        {verifyResult.status === 'verified' ? '✅' : verifyResult.status === 'pending' ? '⏳' : '❌'}
                                        {verifyResult.message || (verifyResult.status === 'verified' ? 'Summary integrity verified on Avalanche C-Chain' : 'Verification status unknown')}
                                        {verifyResult.explorer_url && (
                                            <a href={verifyResult.explorer_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'inherit', textDecoration: 'underline' }}>
                                                View on Snowtrace ↗
                                            </a>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="summary-section">
                        <h3 className="summary-section-title">📋 Summary</h3>
                        <p style={{ color: 'var(--text-muted)' }}>
                            AI summary is being generated... This typically takes 15-30 seconds.
                        </p>
                    </div>
                )}

                {/* Historical Ecosystem Context */}
                {similarProposals.length > 0 && (
                    <div className="summary-section" style={{ marginTop: '1.5rem', background: 'rgba(20, 20, 30, 0.4)' }}>
                        <h3 className="summary-section-title">🔮 Historical Ecosystem Context</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Similar active/past proposals within the {proposal.space} ecosystem.
                        </p>
                        <div className="flex flex-col gap-3">
                            {similarProposals.map((sim, i) => (
                                <a key={i} href={`/proposals/${sim.id}`} className="block border border-gray-800 rounded-md p-3 hover:bg-gray-800/50 transition-colors">
                                    <div className="text-sm font-semibold text-gray-300 line-clamp-1">{sim.title}</div>
                                    <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                        <span className="text-blue-400 capitalize">{sim.space}</span>
                                        {sim.end_time && (
                                            <span>Ended: {new Date(sim.end_time * 1000).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Original Proposal Text */}
                <div className="summary-section" style={{ marginTop: '1.5rem' }}>
                    <h3 className="summary-section-title">📄 Original Proposal</h3>
                    <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        padding: '1rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        {proposal.body}
                    </div>
                </div>
            </div>
        </>
    );
}
