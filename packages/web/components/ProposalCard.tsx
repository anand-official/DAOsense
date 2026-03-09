'use client';

import Link from 'next/link';
import type { Risk, ProposalType, FinancialImpact } from '@daosense/shared';

interface ProposalCardProps {
    id: string;
    space: string;
    title: string;
    summary?: string[];
    endTime?: number;
    proposalType?: ProposalType;
    risks?: Risk[];
    financialImpact?: FinancialImpact | null;
}

function getSpaceClass(space: string): string {
    if (space.includes('traderjoe')) return 'traderjoe';
    if (space.includes('benqi')) return 'benqi';
    if (space.includes('pangolin')) return 'pangolin';
    return '';
}

function getSpaceLabel(space: string): string {
    if (space.includes('traderjoe')) return 'Trader Joe';
    if (space.includes('benqi')) return 'Benqi';
    if (space.includes('pangolin')) return 'Pangolin';
    return space;
}

function getTypeLabel(type: ProposalType | undefined): string {
    if (!type || type === 'other') return 'Discussion';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getHighestRisk(risks: Risk[] | undefined): Risk | null {
    if (!risks || risks.length === 0) return null;
    return risks.reduce((prev, current) =>
        (current.confidence === 'high' ? current : prev)
        , risks[0]);
}

function getTimeRemaining(endTime?: number): { text: string; urgent: boolean } {
    if (!endTime) return { text: 'No deadline', urgent: false };
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    if (diff <= 0) return { text: 'Ended', urgent: true };
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return { text: `${days}d ${hours}h remaining`, urgent: days <= 1 };
    const minutes = Math.floor((diff % 3600) / 60);
    return { text: `${hours}h ${minutes}m remaining`, urgent: true };
}

export default function ProposalCard({
    id,
    space,
    title,
    summary,
    endTime,
    proposalType,
    risks,
    financialImpact
}: ProposalCardProps) {
    const spaceClass = getSpaceClass(space);
    const spaceLabel = getSpaceLabel(space);
    const time = getTimeRemaining(endTime);

    const typeLabel = getTypeLabel(proposalType);
    const highestRisk = getHighestRisk(risks);

    // Determine the border risk color
    let riskSeverityClass = 'border-gray-800'; // default
    if (highestRisk) {
        if (highestRisk.risk_type === 'financial' && highestRisk.confidence === 'high') riskSeverityClass = 'border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.15)]';
        else if (highestRisk.confidence === 'high') riskSeverityClass = 'border-orange-900';
    }

    return (
        <Link href={`/proposals/${id}`} className="group block h-full">
            <div className={`proposal-card animate-in border ${riskSeverityClass} transition-all duration-300 hover:border-gray-600 h-full flex flex-col`}>
                <div className="card-header flex justify-between items-center mb-3">
                    <div className="flex gap-2 items-center">
                        <span className={`space-badge ${spaceClass} px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider`}>
                            {spaceLabel}
                        </span>
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                            {typeLabel}
                        </span>
                    </div>
                </div>

                <h3 className="card-title text-xl font-bold text-white mb-2 line-clamp-2 hover:text-blue-400 transition-colors">{title}</h3>

                {/* Risk and Finance Highlights */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {financialImpact && financialImpact.amount && financialImpact.amount !== "0" && (
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-900/40 text-green-400 border border-green-800/50 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {financialImpact.amount} {financialImpact.token}
                        </span>
                    )}
                    {highestRisk && (
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border ${highestRisk.confidence === 'high' ? 'bg-red-900/40 text-red-400 border-red-800/50' : 'bg-orange-900/40 text-orange-400 border-orange-800/50'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {highestRisk.risk_type.toUpperCase()} RISK
                        </span>
                    )}
                </div>

                {summary && summary.length > 0 && (
                    <p className="card-summary text-gray-400 text-sm line-clamp-2 mb-4 leading-relaxed">{summary[0]}</p>
                )}

                <div className="card-footer flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-800/50 mt-auto">
                    <span className={`time-remaining flex items-center gap-1 ${time.urgent ? 'text-orange-400 font-semibold' : ''}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {time.text}
                    </span>
                    <span className="card-action text-blue-500 font-medium group-hover:text-blue-400 flex items-center gap-1 transition-colors">
                        Analyze <span className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-5px] group-hover:translate-x-0">→</span>
                    </span>
                </div>
            </div>
        </Link>
    );
}
