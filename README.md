# DAOSense 🔺

> AI-powered governance copilot for Avalanche DAOs — verified on-chain summaries, delivered in seconds.

Built for the **Avalanche Build Games 2026** hackathon.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-blue)](https://ai.google.dev)
[![Avalanche](https://img.shields.io/badge/Chain-Avalanche-red)](https://avax.network)

---

## What is DAOSense?

DAOSense transforms dense DAO governance proposals into clear, verifiable AI summaries. Any token holder can understand what's being proposed, spot risks, and verify the summary authenticity on-chain — all in under 2 minutes.

**Core problem:** DAO governance participation is typically <5% because proposals are long, technical, and hard to parse.

**Solution:** AI-powered 3-bullet summaries with confidence scores, financial impact detection, and Merkle-verified integrity.

---

## Features

- 🤖 **Gemini 2.0 Flash AI** — tiered prompt routing (simple vs. chain-of-thought) with confidence scoring
- 🔗 **On-chain verification** — Merkle batch hashing of proposals + summaries, stored via `ProposalVerifier.sol`
- 📊 **Live dashboard** — real-time proposals from Snapshot (Trader Joe, Benqi, Pangolin & more)
- ⚠️ **Low-confidence warnings** — flags uncertain summaries with source citation validation
- 🕐 **Hourly cron sync** — automatic proposal fetching via Vercel cron jobs
- 🆓 **$0/month hosting** — Vercel Hobby + Supabase Free + Gemini Free Tier

---

## Architecture

```
Snapshot GraphQL API
        ↓
  Hourly Cron Job (/api/cron/fetch-proposals)
        ↓
  Supabase PostgreSQL (proposals, summaries, batches)
        ↓
  Gemini 2.0 Flash AI (tiered router + confidence scoring)
        ↓
  Merkle Batch Builder → ProposalVerifier.sol (Avalanche)
        ↓
  Next.js Dashboard (dark theme, Avalanche-inspired)
```

### Monorepo Structure

```
DAOSense/
├── packages/
│   ├── shared/          # Types, hashing, Merkle utilities
│   ├── contracts/       # ProposalVerifier.sol + Hardhat
│   └── web/             # Next.js app (frontend + API)
│       ├── app/
│       │   ├── page.tsx                        # Dashboard home
│       │   ├── proposals/[id]/page.tsx         # Proposal detail
│       │   └── api/
│       │       ├── proposals/route.ts
│       │       ├── summaries/[id]/route.ts
│       │       ├── verify/[id]/route.ts
│       │       └── cron/fetch-proposals/route.ts
│       └── lib/
│           ├── db.ts                  # Supabase client
│           ├── gemini.ts              # Gemini AI client
│           ├── adapters/snapshot.ts   # Snapshot GraphQL adapter
│           ├── ai/                    # Router, prompts, confidence
│           └── verification/          # Batch builder, submitter
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone & Install

```bash
git clone https://github.com/anand-official/DAOsense.git
cd DAOsense
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI (get from aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_key

# Avalanche Fuji Testnet
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=your_wallet_private_key
NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=deployed_contract_address

# Vercel Cron
CRON_SECRET=your_cron_secret
```

### 3. Set Up Database

Run `packages/web/lib/db/schema.sql` in your Supabase SQL Editor.

### 4. Run Dev Server

```bash
npm run dev --workspace=@daosense/web
# → http://localhost:3000
```

### 5. Fetch Proposals (trigger cron manually)

```bash
curl -H "Authorization: Bearer your_cron_secret" \
  http://localhost:3000/api/cron/fetch-proposals
```

---

## Smart Contract

`ProposalVerifier.sol` stores Merkle roots of (proposal hash, summary hash) pairs on Avalanche, enabling trustless verification.

```bash
cd packages/contracts
npm run compile
npm run deploy --network fuji
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/proposals` | GET | List all proposals (filter by `?space=`) |
| `/api/summaries/[id]` | GET/POST | Get or generate AI summary |
| `/api/verify/[id]` | GET | Get Merkle proof for on-chain verification |
| `/api/cron/fetch-proposals` | GET | Trigger proposal sync + AI summarization |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Vanilla CSS, glassmorphism dark theme |
| AI | Google Gemini 2.0 Flash |
| Database | Supabase (PostgreSQL) |
| Blockchain | Avalanche C-Chain, viem |
| Data Source | Snapshot.org GraphQL API |
| Hosting | Vercel (Hobby tier — free) |
| Monorepo | Turborepo |

---

## Hackathon Context

**Event:** Avalanche Build Games 2026 — Stage 2 MVP  
**Deadline:** March 9, 2026  
**Category:** Governance / DeFi Tooling  

Key Avalanche features utilized:
- Post-Octane sub-penny transaction fees for on-chain batch submissions
- Fuji testnet for development
- Avalanche C-Chain for `ProposalVerifier` contract deployment

---

## License

MIT © 2026 DAOSense
