/**
 * Domain types mirroring the real AgentSheild contract (contracts/AgentSheild.py)
 * view outputs. Every field here is sourced from an on-chain read — there are no
 * synthetic/mock fields (no timestamps, no per-validator verdicts) because the
 * contract does not expose them.
 */

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AgentStatus = 'active' | 'paused' | 'delisted';
export type ClaimStatus = 'pending' | 'valid' | 'paid' | 'invalid' | 'duplicate' | 'disputed';
export type Decision = 'valid' | 'invalid' | 'duplicate';
export type SystemStatus = 'OPERATIONAL' | 'AUDITS_PENDING' | 'DISPUTE_OPEN';
export type Posture = 'NOMINAL' | 'SETTLED' | 'DISPUTED';

/** GEN in wei (atto-GEN, 1e18), matching the contract's u256 money scale. */
export type Gen = bigint;

export interface LiabilityTiers {
  critical: Gen;
  high: Gen;
  medium: Gen;
  low: Gen;
  info: Gen;
}

export interface Agent {
  id: number;
  operator: string;
  name: string;
  policy: string;
  liabilities: LiabilityTiers;
  bond: Gen;
  status: AgentStatus;
  /** total claims ever filed against this agent (contract agent_claim_counts) */
  claimCount: number;
  /** claims still pending or under dispute on this agent */
  openClaims: number;
  /** true while openClaims > 0: bond cannot be delisted, table cannot be retiered */
  frozen: boolean;
}

export interface Claim {
  id: number;
  agentId: number;
  agentName: string;
  claimant: string;
  title: string;
  description: string;
  evidence: string;
  impact: string;
  severityClaimed: Severity;
  severityAi: Severity | null;
  status: ClaimStatus;
  duplicateOf: number;
  payout: Gen;
  auditReason: string | null;
  /** amount already delivered to the claimant (contract paid_out) */
  paidOut: Gen;
  /** liability table bound at filing — pricing terms for this claim */
  boundTiers: LiabilityTiers;
}

/** Dispute as returned by get_dispute(): liability table frozen at raise time. */
export interface Dispute {
  id: number;
  claimId: number;
  raisedBy: string;
  reason: string;
  resolved: boolean;
  outcome: string;
  /** true only after a terminal arbitration (not a requeue) */
  settled: boolean;
  frozenTiers: LiabilityTiers;
}

export type ActivityKind = 'Claims' | 'Consensus' | 'Payout' | 'Registry' | 'Disputes';

/**
 * A readable event derived from current on-chain state (claim/dispute records).
 * The contract emits no event log, so this is a projection of live storage,
 * not a replay of historical transactions.
 */
export interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  kind: ActivityKind;
}

export const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
export const SEVERITY_INDEX: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** wei → GEN display string; keeps enough precision that sub-GEN (real) amounts never read as "0". */
export function formatGen(v: Gen, maxFrac = 18): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** 18n;
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(18, '0').slice(0, maxFrac);
  frac = frac.replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toLocaleString()}${frac ? '.' + frac : ''}`;
}

/** Build a wei (atto-GEN) amount from a whole-GEN number. */
export const GEN = (n: number): Gen => BigInt(Math.round(n * 1e6)) * 10n ** 12n;
