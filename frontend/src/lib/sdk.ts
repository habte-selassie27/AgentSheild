/**
 * AgentSheild SDK — live service layer between the UI and the deployed
 * GenLayer intelligent contract (contracts/AgentSheild.py).
 *
 * Reads call the contract's view methods over the StudioNet RPC.
 * Writes are signed by the injected wallet (MetaMask + GenLayer snap).
 */
import { client, CONTRACT } from './genlayer';
import type { Agent, AgentStatus, Claim, ClaimStatus, Decision, Dispute, Gen, Severity } from './types';

const ADDR = CONTRACT;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Coerce a decoded u256 (number | bigint | string) into a bigint safely. */
export function toGen(v: unknown): Gen {
  if (v === null || v === undefined) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  try {
    return BigInt(String(v));
  } catch {
    return 0n;
  }
}

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  try {
    return Number(toGen(v));
  } catch {
    return 0;
  }
};

const SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
function normSev(v: unknown): Severity {
  const s = String(v ?? '').trim().toLowerCase();
  return (SEVERITIES as string[]).includes(s) ? (s as Severity) : 'info';
}

/* ------------------------------------------------------------------ reads */

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await client.readContract({ address: ADDR, functionName, args: args as any })) as T;
}

/**
 * Read a key-addressed record. The contract's TreeMaps revert on an absent key
 * (e.g. get_agent(999) when only agents 1..N exist), which is how we detect the
 * end of a contiguous id range. A single retry absorbs transient RPC hiccups.
 */
async function tryRead<T>(functionName: string, args: unknown[]): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await read<T>(functionName, args);
    } catch {
      if (attempt === 0) await delay(250);
    }
  }
  return null;
}

/** The contract returns JSON-encoded id arrays as plain strings. */
function parseIds(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((x) => toNum(x));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => toNum(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapAgent(r: any): Agent {
  const l = r?.liabilities ?? {};
  return {
    id: toNum(r?.id),
    operator: String(r?.operator ?? ''),
    name: String(r?.name ?? ''),
    policy: String(r?.policy ?? ''),
    liabilities: {
      critical: toGen(l.critical),
      high: toGen(l.high),
      medium: toGen(l.medium),
      low: toGen(l.low),
      info: 0n,
    },
    bond: toGen(r?.bond_bal),
    status: String(r?.status ?? 'active') as AgentStatus,
    claimCount: toNum(r?.claims),
  };
}

function mapClaim(r: any, agentName: string): Claim {
  const ai = r?.severity_ai;
  return {
    id: toNum(r?.id),
    agentId: toNum(r?.agent_id),
    agentName,
    claimant: String(r?.claimant ?? ''),
    title: String(r?.title ?? ''),
    description: String(r?.description ?? ''),
    evidence: String(r?.evidence ?? ''),
    impact: String(r?.impact ?? ''),
    severityClaimed: normSev(r?.claimed),
    severityAi: ai ? normSev(ai) : null,
    status: String(r?.status ?? 'pending') as ClaimStatus,
    duplicateOf: toNum(r?.duplicate_of),
    payout: toGen(r?.payout),
    auditReason: r?.reason ? String(r.reason) : null,
  };
}

function mapDispute(r: any): Dispute {
  const l = r?.bound_liabilities ?? {};
  return {
    id: toNum(r?.id),
    claimId: toNum(r?.claim_id),
    raisedBy: String(r?.raised_by ?? ''),
    reason: String(r?.reason ?? ''),
    resolved: Boolean(r?.resolved),
    outcome: String(r?.outcome ?? ''),
    frozenTiers: {
      critical: toGen(l.critical),
      high: toGen(l.high),
      medium: toGen(l.medium),
      low: toGen(l.low),
      info: 0n,
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface Registry {
  agents: Agent[];
  claims: Claim[];
  disputes: Dispute[];
}

const MAX_IDS = 500;

/**
 * Enumerate the whole registry from the contract's key-addressed views.
 * Agent/claim/dispute ids are contiguous (counters start at 1), so probing
 * upwards until a revert gives the exact set — there is no list-all view.
 */
export async function loadRegistry(): Promise<Registry> {
  const agents: Agent[] = [];
  for (let id = 1; id <= MAX_IDS; id++) {
    const raw = await tryRead<unknown>('get_agent', [BigInt(id)]);
    if (raw == null) break;
    agents.push(mapAgent(raw));
  }

  // Collect every claim id: agent-indexed lists (paginated) + the pending queue.
  const claimIds = new Set<number>();
  for (const a of agents) {
    for (let offset = 0, page = 0; page < 100; page++, offset += 50) {
      const raw = await tryRead<unknown>('get_agent_claims', [BigInt(a.id), BigInt(offset), 50n]);
      const ids = parseIds(raw);
      for (const id of ids) claimIds.add(id);
      if (ids.length < 50) break;
    }
  }
  const pendingRaw = await tryRead<unknown>('get_pending_queue', [50n]);
  for (const id of parseIds(pendingRaw)) claimIds.add(id);

  const byId = new Map(agents.map((a) => [a.id, a]));
  const claims: Claim[] = [];
  for (const id of [...claimIds].sort((a, b) => b - a)) {
    const raw = await tryRead<{ agent_id?: unknown }>('get_claim', [BigInt(id)]);
    if (raw == null) continue;
    const agentId = toNum((raw as { agent_id?: unknown }).agent_id);
    claims.push(mapClaim(raw, byId.get(agentId)?.name ?? `Agent #${agentId}`));
  }

  const disputes: Dispute[] = [];
  for (let id = 1; id <= MAX_IDS; id++) {
    const raw = await tryRead<unknown>('get_dispute', [BigInt(id)]);
    if (raw == null) break;
    disputes.push(mapDispute(raw));
  }

  return { agents, claims, disputes };
}

/* ------------------------------------------------------------------ wallet */

/** Silently read already-authorized accounts (no popup). */
export async function getAccounts(): Promise<string[]> {
  const eth = window.ethereum;
  if (!eth) return [];
  try {
    return (await eth.request({ method: 'eth_accounts' })) as string[];
  } catch {
    return [];
  }
}

/**
 * Connect the injected wallet: switch to StudioNet, install/request the GenLayer
 * snap (needed to interpret contract calls), then read the active account.
 */
export async function connectWallet(): Promise<string> {
  const eth = window.ethereum;
  if (!eth) throw new Error('MetaMask is not installed. Install it to send transactions.');
  await client.connect('studionet', 'npm');
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('No account returned by wallet.');
  return accounts[0];
}

export function shortAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/* ------------------------------------------------------------------ writes */

/** Send a real transaction through the connected wallet. Returns the tx hash. */
export async function write(
  functionName: string,
  args: unknown[],
  value: Gen = 0n,
  account?: string | null,
): Promise<string> {
  const hash = await client.writeContract({
    /* genlayer-js routes signing through window.ethereum when account is an address */
    account: (account ?? undefined) as never,
    address: ADDR,
    functionName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: args as any,
    value,
  });
  return String(hash);
}

export const sdk = {
  loadRegistry,
  getAccounts,
  connectWallet,
  shortAddr,

  registerAgent: (
    name: string, policy: string, description: string,
    liabilities: [Gen, Gen, Gen, Gen], account?: string | null,
  ) => write('register_agent', [name, policy, description, ...liabilities], 0n, account),

  /** bond_agent is payable: the GEN is sent as the tx value. */
  bondAgent: (agentId: number, amount: Gen, account?: string | null) =>
    write('bond_agent', [BigInt(agentId)], amount, account),

  setAgentStatus: (agentId: number, status: AgentStatus, account?: string | null) => {
    const fn = status === 'active' ? 'resume_agent' : status === 'paused' ? 'pause_agent' : 'delist_agent';
    return write(fn, [BigInt(agentId)], 0n, account);
  },

  fileClaim: (
    input: { agentId: number; title: string; description: string; evidence: string; impact: string; severity: Severity },
    account?: string | null,
  ) => write('file_claim', [
    BigInt(input.agentId), input.title, input.description, input.evidence, input.impact, input.severity,
  ], 0n, account),

  /** The only nondeterministic method — runs full validator consensus (slow). */
  auditClaim: (claimId: number, account?: string | null) =>
    write('audit_claim', [BigInt(claimId)], 0n, account),

  claimPayout: (claimId: number, account?: string | null) =>
    write('claim_payout', [BigInt(claimId)], 0n, account),

  raiseDispute: (claimId: number, reason: string, account?: string | null) =>
    write('raise_dispute', [BigInt(claimId), reason], 0n, account),

  resolveDispute: (disputeId: number, outcome: Decision, severity: Severity, account?: string | null) =>
    write('resolve_dispute', [BigInt(disputeId), outcome, severity], 0n, account),

  requeueDisputed: (claimId: number, account?: string | null) =>
    write('requeue_disputed', [BigInt(claimId)], 0n, account),
};
