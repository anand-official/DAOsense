import type { Proposal, ProposalAdapter } from '@daosense/shared';

const SNAPSHOT_GRAPHQL_URL =
  process.env.SNAPSHOT_GRAPHQL_URL || 'https://hub.snapshot.org/graphql';

const SNAPSHOT_SPACES = (
  process.env.SNAPSHOT_SPACES || 'traderjoe-xyz,benqi-finance,pangolin-exchange'
)
  .split(',')
  .map((space) => space.trim())
  .filter(Boolean);

const ACTIVE_PROPOSALS_QUERY = `
  query ActiveProposals($spaces: [String!]!) {
    proposals(
      where: { space_in: $spaces, state: "active" }
      orderBy: "created"
      orderDirection: desc
      first: 100
    ) {
      id
      title
      body
      author
      start
      end
      state
      space {
        id
      }
    }
  }
`;

const RECENT_PROPOSALS_QUERY = `
  query RecentProposals($spaces: [String!]!) {
    proposals(
      where: { space_in: $spaces }
      orderBy: "created"
      orderDirection: desc
      first: 20
    ) {
      id
      title
      body
      author
      start
      end
      state
      space {
        id
      }
    }
  }
`;

const PROPOSAL_BY_ID_QUERY = `
  query ProposalById($id: String!) {
    proposal(id: $id) {
      id
      title
      body
      author
      start
      end
      state
      space {
        id
      }
    }
  }
`;

interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  author: string;
  start: number;
  end: number;
  state: string;
  space: { id: string };
}

/**
 * Fetch data from Snapshot GraphQL API with retry logic.
 */
async function snapshotQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(SNAPSHOT_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Snapshot API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
      }

      return json.data as T;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Snapshot query failed after all retries');
}

function mapToProposal(sp: SnapshotProposal): Proposal {
  return {
    id: sp.id,
    space: sp.space.id,
    title: sp.title,
    body: sp.body,
    author: sp.author,
    start: sp.start,
    end: sp.end,
    source: 'snapshot',
    state: sp.state,
  };
}

/**
 * Snapshot.org adapter — primary data source for DAOSense MVP.
 */
export const snapshotAdapter: ProposalAdapter = {
  name: 'snapshot',

  async fetchActiveProposals(): Promise<Proposal[]> {
    const data = await snapshotQuery<{ proposals: SnapshotProposal[] }>(
      ACTIVE_PROPOSALS_QUERY,
      { spaces: SNAPSHOT_SPACES }
    );
    return data.proposals.map(mapToProposal);
  },

  async fetchProposalById(id: string): Promise<Proposal | null> {
    const data = await snapshotQuery<{ proposal: SnapshotProposal | null }>(
      PROPOSAL_BY_ID_QUERY,
      { id }
    );
    return data.proposal ? mapToProposal(data.proposal) : null;
  },
};

/**
 * Fetch recent proposals (any state) as fallback.
 */
export async function fetchRecentProposals(): Promise<Proposal[]> {
  const data = await snapshotQuery<{ proposals: SnapshotProposal[] }>(
    RECENT_PROPOSALS_QUERY,
    { spaces: SNAPSHOT_SPACES }
  );
  return data.proposals.map(mapToProposal);
}
