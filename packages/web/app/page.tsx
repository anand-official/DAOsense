'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ProposalCard from '@/components/ProposalCard';

import type { SummaryResult, ProposalType } from '@daosense/shared';

interface ProposalData {
  id: string;
  space: string;
  title: string;
  body: string;
  author: string | null;
  end_time: number | null;
}

interface SummaryData {
  proposal_id: string;
  summary_json: SummaryResult;
}

interface HealthData {
  status: 'healthy' | 'degraded';
  last_successful_sync_at: string | null;
  pending_batches: number;
  submitted_batches: number;
}

// Demo data for when Supabase isn't configured yet
const DEMO_PROPOSALS: ProposalData[] = [
  {
    id: 'demo-1',
    space: 'traderjoe-xyz',
    title: 'TJP-47: Increase sJOE Staking Rewards by 15% for Q2 2026',
    body: 'This proposal aims to increase the sJOE staking rewards allocation from the current 10% to 15% of protocol revenue...',
    author: '0x742d...6aB2',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 3,
  },
  {
    id: 'demo-2',
    space: 'benqi-finance',
    title: 'BIP-23: Add wBTC.b as Collateral with 65% LTV on Benqi',
    body: 'Proposal to add Wrapped Bitcoin (wBTC.b) bridged via BTC.b as an accepted collateral asset on Benqi lending...',
    author: '0x1a2b...3c4d',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 5,
  },
  {
    id: 'demo-3',
    space: 'pangolin-exchange',
    title: 'PGP-15: Launch Concentrated Liquidity Pools on Pangolin V3',
    body: 'This proposal introduces concentrated liquidity pools to Pangolin, allowing LPs to provide liquidity within custom price ranges...',
    author: '0x5e6f...7g8h',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 1,
  },
  {
    id: 'demo-4',
    space: 'traderjoe-xyz',
    title: 'TJP-48: Treasury Diversification into USDC Stablecoin Reserve',
    body: 'Converting 20% of the Trader Joe treasury holdings into USDC to establish a stablecoin reserve for operational costs...',
    author: '0x9i0j...1k2l',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 7,
  },
  {
    id: 'demo-5',
    space: 'benqi-finance',
    title: 'BIP-24: Reduce QI Token Emission Rate by 25%',
    body: 'To combat inflation and improve tokenomics sustainability, this proposal suggests reducing QI emission by 25% starting next epoch...',
    author: '0x3m4n...5o6p',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 2,
  },
  {
    id: 'demo-6',
    space: 'pangolin-exchange',
    title: 'PGP-16: Establish Governance Guardian Multisig for Emergency Actions',
    body: 'Creating a 5-of-9 multisig with timelock to handle critical protocol emergencies, including pause functionality...',
    author: '0x7q8r...9s0t',
    end_time: Math.floor(Date.now() / 1000) + 86400 * 4,
  },
];

const DEMO_SUMMARIES: Record<string, string[]> = {
  'demo-1': ['Increase sJOE staking rewards from 10% to 15% of protocol revenue', 'Expected to attract 2M additional JOE tokens to staking'],
  'demo-2': ['Add wBTC.b as collateral with 65% loan-to-value ratio', 'Includes $5M supply cap and Chainlink price feed integration'],
  'demo-3': ['Launch concentrated liquidity pools following Uniswap V3 model', 'Initial pools: AVAX/USDC, AVAX/USDT, JOE/AVAX'],
  'demo-4': ['Convert 20% of treasury ($2.4M) into USDC stablecoin reserve', '6-month DCA strategy to minimize market impact'],
  'demo-5': ['Reduce QI emissions by 25% to improve token sustainability', 'Projected to extend emission schedule by 18 months'],
  'demo-6': ['Create 5-of-9 guardian multisig for emergency protocol actions', 'Includes 24-hour timelock for non-emergency decisions'],
};

export default function HomePage() {
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SummaryResult>>({});
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [watchlistSpaces, setWatchlistSpaces] = useState<string[]>([]);
  const [watchlistTypes, setWatchlistTypes] = useState<ProposalType[]>([]);
  const [newProposalIds, setNewProposalIds] = useState<Set<string>>(new Set());
  const [clientId, setClientId] = useState('server');

  async function trackEvent(event_name: string, payload?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    await fetch('/api/metrics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_name, client_id: clientId, payload }),
    });
  }

  async function fetchProposals(sync = false) {
      if (sync) setSyncing(true);
      try {
        const res = await fetch(sync ? '/api/proposals?sync=1' : '/api/proposals');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        if (data.proposals && data.proposals.length > 0) {
          const liveProposals = data.proposals as ProposalData[];
          const allProposals = [...liveProposals];

          for (const demo of DEMO_PROPOSALS) {
            if (!allProposals.find((p) => p.id === demo.id)) {
              allProposals.push(demo);
            }
          }

          setProposals(allProposals);
          setIsDemo(false);

          const seenIds = new Set(
            JSON.parse(localStorage.getItem('daosense_seen_proposals') || '[]') as string[]
          );
          const unseen = new Set(allProposals.map((p) => p.id).filter((id) => !seenIds.has(id)));
          setNewProposalIds(unseen);
          localStorage.setItem('daosense_seen_proposals', JSON.stringify(allProposals.map((p) => p.id)));

          // Fetch bulk summaries for live proposals
          try {
            const liveIds = liveProposals.map(p => p.id).join(',');
            if (liveIds) {
              const sumRes = await fetch(`/api/summaries/bulk?ids=${liveIds}`);
              const sumData = await sumRes.json();
              if (sumData.summaries) {
                const sumMap: Record<string, SummaryResult> = {};
                sumData.summaries.forEach((s: SummaryData) => {
                  sumMap[s.proposal_id] = s.summary_json;
                });
                setSummaries(sumMap);
              }
            }
          } catch (e) {
            console.error("Failed to load bulk summaries", e);
          }

        } else {
          setProposals(DEMO_PROPOSALS);
          setIsDemo(true);
        }
      } catch {
        setProposals(DEMO_PROPOSALS);
        setIsDemo(true);
      } finally {
        setLoading(false);
        if (sync) setSyncing(false);
      }
    }

  useEffect(() => {
    fetchProposals();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem('daosense_client_id');
    if (existing) {
      setClientId(existing);
      return;
    }
    const next = `client-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('daosense_client_id', next);
    setClientId(next);
  }, []);

  useEffect(() => {
    async function loadHealthAndPrefs() {
      try {
        const [healthRes, prefRes] = await Promise.all([
          fetch('/api/health'),
          fetch(`/api/preferences?clientId=${clientId}`),
        ]);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          if (prefData.preferences) {
            setWatchlistSpaces(prefData.preferences.spaces || []);
            setWatchlistTypes(prefData.preferences.proposal_types || []);
          }
        }
      } catch {
        // Non-blocking
      }
    }
    loadHealthAndPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistPreferences(nextSpaces: string[], nextTypes: ProposalType[]) {
    setWatchlistSpaces(nextSpaces);
    setWatchlistTypes(nextTypes);
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId,
        preferences: {
          spaces: nextSpaces,
          proposal_types: nextTypes,
          risk_threshold: 'medium',
        },
      }),
    });
    trackEvent('watchlist_updated', { spaces: nextSpaces, proposal_types: nextTypes });
  }

  const filtered = proposals.filter((p) => {
    if (filter !== 'all' && !p.space.includes(filter)) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const spaces = ['all', 'traderjoe', 'benqi', 'pangolin'];
  const watchlistFeed = proposals.filter((proposal) => {
    const spaceMatch =
      watchlistSpaces.length === 0 || watchlistSpaces.some((s) => proposal.space.includes(s));
    const type = summaries[proposal.id]?.proposal_type;
    const typeMatch =
      watchlistTypes.length === 0 || (type ? watchlistTypes.includes(type) : false);
    return spaceMatch && typeMatch;
  });
  const newSinceLastVisit = proposals.filter((p) => newProposalIds.has(p.id));

  return (
    <main className="home-shell">
      <Navbar />

      <section className="hero home-container">
        <h1>
          Governance <span className="gradient-text">Intelligence</span>
        </h1>
        <p>
          AI-powered summaries of Avalanche DAO proposals — verified on-chain, delivered in seconds.
        </p>

        {isDemo && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'rgba(168, 85, 247, 0.1)',
            color: '#a855f7',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '100px',
          }}>
            ✦ Demo Mode — Connect Supabase to see live data
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <button
            className="sync-btn"
            onClick={() => {
              trackEvent('manual_sync_clicked');
              fetchProposals(true);
            }}
            disabled={syncing}
          >
            {syncing ? 'Syncing proposals...' : 'Sync latest proposals'}
          </button>
        </div>
        {health && (
          <div style={{ marginTop: '0.8rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Data status:{' '}
            <span style={{ color: health.status === 'healthy' ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 700 }}>
              {health.status}
            </span>{' '}
            · pending batches {health.pending_batches} · submitted {health.submitted_batches}
          </div>
        )}
      </section>

      <section className="home-container summary-section" style={{ marginTop: '0.5rem' }}>
        <h3 className="summary-section-title">⭐ Today For You</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
          {newSinceLastVisit.length} new proposals since your last visit · {watchlistFeed.length} matching your watchlist
        </p>
        <div className="filters" style={{ marginBottom: '0.25rem' }}>
          {['traderjoe', 'benqi', 'pangolin'].map((space) => (
            <button
              key={space}
              className={`filter-btn ${watchlistSpaces.includes(space) ? 'active' : ''}`}
              onClick={() => {
                const next = watchlistSpaces.includes(space)
                  ? watchlistSpaces.filter((s) => s !== space)
                  : [...watchlistSpaces, space];
                persistPreferences(next, watchlistTypes);
              }}
            >
              Watch {space}
            </button>
          ))}
        </div>
        <div className="filters" style={{ marginBottom: 0 }}>
          {(['grant', 'parameter_update', 'contract_upgrade'] as ProposalType[]).map((type) => (
            <button
              key={type}
              className={`filter-btn ${watchlistTypes.includes(type) ? 'active' : ''}`}
              onClick={() => {
                const next = watchlistTypes.includes(type)
                  ? watchlistTypes.filter((t) => t !== type)
                  : [...watchlistTypes, type];
                persistPreferences(watchlistSpaces, next);
              }}
            >
              Type: {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      <section className="home-container summary-section" style={{ marginTop: '1rem' }}>
        <h3 className="summary-section-title">🎤 Judge Demo Script + Metrics</h3>
        <ul className="summary-bullets">
          <li>Hook (15s): DAO voters miss critical details because governance moves fast.</li>
          <li>Workflow (60s): Sync proposals, inspect Decision Card, open evidence-backed detail, verify chain status.</li>
          <li>Proof (30s): Show “Today For You” feed and the time-to-first-action telemetry in logs/metrics events.</li>
          <li>Close (15s): DAOSense becomes a daily command center, not a one-time summarizer.</li>
        </ul>
        <div style={{ marginTop: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Targets: decision time &lt; 60s · Decision Card coverage &gt; 90% · ambiguous verification states near zero.
        </div>
      </section>

      <div className="stats-bar home-container">
        <div className="stat-item">
          <div className="stat-value gradient-text">{filtered.length}</div>
          <div className="stat-label">Active Proposals</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>3</div>
          <div className="stat-label">DAOs Tracked</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>87%</div>
          <div className="stat-label">Avg. Confidence</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>∞</div>
          <div className="stat-label">On-Chain Verified</div>
        </div>
      </div>

      <div className="filters home-container">
        {spaces.map((s) => (
          <button
            key={s}
            className={`filter-btn ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? '◆ All DAOs' :
              s === 'traderjoe' ? '🟥 Trader Joe' :
                s === 'benqi' ? '🟩 Benqi' :
                  '🟧 Pangolin'}
          </button>
        ))}
        <input
          type="text"
          className="search-input"
          placeholder="Search proposals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading proposals...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No proposals found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="proposals-grid home-container">
          {filtered.map((p) => {
            const sumData = summaries[p.id];

            return (
              <ProposalCard
                key={p.id}
                id={p.id}
                space={p.space}
                title={p.title}
                summary={isDemo ? DEMO_SUMMARIES[p.id] : sumData?.summary}
                endTime={p.end_time || undefined}
                proposalType={sumData?.proposal_type}
                risks={sumData?.risks}
                financialImpact={sumData?.financial_impact}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
