-- ===== DAOSense Database Schema =====
-- Run this in Supabase SQL Editor to set up tables

-- Proposals table: stores raw governance proposals
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  space TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT,
  start_time BIGINT,
  end_time BIGINT,
  raw_content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'snapshot',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Summaries table: AI-generated analysis for each proposal
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT REFERENCES proposals(id),
  summary_json JSONB NOT NULL,
  hash_proposal TEXT NOT NULL,
  hash_summary TEXT NOT NULL,
  overall_confidence REAL,
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id)
);

-- Batches table: Merkle batch records for on-chain verification
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merkle_root TEXT NOT NULL,
  tx_hash TEXT,
  chain_id INT DEFAULT 43113,
  leaf_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table: community-reported inaccuracies
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT REFERENCES proposals(id),
  summary_id UUID REFERENCES summaries(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_proposals_space ON proposals(space);
CREATE INDEX IF NOT EXISTS idx_proposals_end ON proposals(end_time);
CREATE INDEX IF NOT EXISTS idx_summaries_proposal ON summaries(proposal_id);
CREATE INDEX IF NOT EXISTS idx_summaries_batch ON summaries(batch_id);

-- Enable Row Level Security (Supabase best practice)
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies: allow service role full access, anon read-only
CREATE POLICY "Service role full access" ON proposals FOR ALL USING (true);
CREATE POLICY "Public read proposals" ON proposals FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON summaries FOR ALL USING (true);
CREATE POLICY "Public read summaries" ON summaries FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON batches FOR ALL USING (true);
CREATE POLICY "Public read batches" ON batches FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON reports FOR ALL USING (true);
CREATE POLICY "Authenticated can report" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
