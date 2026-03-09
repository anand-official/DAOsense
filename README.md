# DAOSense

AI governance command center for Avalanche DAOs.  
DAOSense helps delegates and contributors **detect what matters, decide faster, and prove integrity**.

## Why DAOSense

DAO proposals are often long, technical, and time-sensitive. DAOSense converts proposal text into actionable intelligence:

- Decision-ready AI summaries (not just text condensation)
- Evidence-linked claims for trust and auditability
- Staged blockchain verification with explicit status
- Reliability and freshness signals on the dashboard

## Core Capabilities

- **Decision Layer**
  - Vote recommendation: `for` / `against` / `abstain`
  - 2-line rationale
  - Risk level + confidence
  - Expected governance/financial change
- **Explainability Layer**
  - Claim-to-source mapping for key points
  - Evidence quality surfaced in UI
- **Verification Layer**
  - Distinct states: batched in DB -> submitted on-chain -> on-chain verified
  - Action hints when chain submission config is missing
- **Reliability Layer**
  - Health endpoint and freshness status
- **Personalization**
  - Watchlist preferences and "Today For You" feed

## High-Level Architecture

1. Snapshot proposals are fetched via API/cron
2. Proposals and summaries are persisted in Supabase
3. Gemini analyzes proposal text and returns structured summary output
4. Merkle batches are created for verification
5. Batch roots are submitted to `ProposalVerifier.sol` (when configured)
6. Next.js app presents decisions, evidence, and verification state

## Monorepo Layout

```text
packages/
  contracts/   # Solidity + Hardhat deployment/tests
  shared/      # Shared types, hashing, Merkle helpers
  web/         # Next.js app (UI + API routes)
```

## Tech Stack

- Frontend/API: Next.js 16, React, TypeScript
- AI: Gemini 2.0 Flash
- Database: Supabase Postgres
- Chain: Avalanche C-Chain (Fuji/Mainnet)
- Contracts: Hardhat 3, Solidity 0.8.x
- Monorepo: Turborepo

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Environment

Create `.env` in repo root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GEMINI_API_KEY=

# Avalanche + verifier (required for on-chain submission)
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
MAINNET_RPC_URL=https://api.avax.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=
NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=

# Cron protection
CRON_SECRET=
```

### Run Locally

```bash
npm run dev
```

### Pre-Release Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Key API Endpoints

- `GET /api/proposals`
- `GET /api/summaries/[proposalId]`
- `POST /api/summaries/[proposalId]`
- `GET /api/verify/[proposalId]`
- `GET /api/cron/fetch-proposals`
- `GET /api/health`
- `GET|POST /api/preferences`
- `POST /api/metrics/event`

## Production Notes

- If verifier env vars are missing, verification remains in non-final stages by design.
- Ensure Supabase schema includes:
  - `proposals`, `summaries`, `batches`
  - `user_preferences`
  - `metrics_events`
- Keep cron secret enabled in all non-local environments.

## Release Documentation

For latest production-preflight logs, cleanup actions, and release checklist, see:

- `RELEASE_PREPROD_REPORT.md`

## License

MIT
