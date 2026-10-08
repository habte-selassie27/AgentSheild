/** Domain types mirroring contracts/AgentSheild.py storage structs. */

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AgentStatus = 'active' | 'paused' | 'delisted';
export type ClaimStatus = 'pending' | 'valid' | 'paid' | 'invalid' | 'duplicate' | 'disputed';
export type Decision = 'valid' | 'invalid' | 'duplicate';
export type Scenario = 'queue' | 'settled' | 'disputed';
export type SystemStatus = 'OPERATIONAL' | 'AUDITS_PENDING' | 'DISPUTE_OPEN' | 'OFFLINE';
export type Posture = 'NOMINAL' | 'SETTLED' | 'DISPUTED' | 'OFFLINE';

/** GEN in atto-GEN (1e18), matching the contract's u256 money scale. */
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
  description: string;
  liabilities: LiabilityTiers;
  bond: Gen;
  status: AgentStatus;
  createdAt: string;
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
  submittedAt: string;
  resolvedAt: string | null;
  auditReason: string | null;
  audit: AuditRound | null;
}

/** One validator's verdict inside audit_claim() consensus. */
export interface ValidatorVerdict {
  node: string;
  region: string;
  decision: Decision;
  severity: Severity;
  duplicateOf: number;
  reward: Gen;
  reason: string;
  latencyMs: number;
}

export interface AuditRound {
  claimId: number;
  principle: string;
  validators: ValidatorVerdict[];
  consensusReached: boolean;
  finalDecision: Decision | null;
  finalReward: Gen | null;
  tx: string | null;
  block: number | null;
}

export interface Dispute {
  id: number;
  claimId: number;
  raisedBy: string;
  reason: string;
  resolved: boolean;
  outcome: string;
  frozenTiers: LiabilityTiers;
  raisedAt: string;
}

export type ActivityKind = 'Claims' | 'Consensus' | 'Payout' | 'Registry' | 'Disputes' | 'System';

export interface ActivityEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  kind: ActivityKind;
}

export const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
export const SEVERITY_INDEX: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** atto-GEN → display string, e.g. 2.5e18 → "2.5" */
export function formatGen(v: Gen, maxFrac = 4): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** 18n;
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(18, '0').slice(0, maxFrac);
  frac = frac.replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toLocaleString()}${frac ? '.' + frac : ''}`;
}

export const GEN = (n: number): Gen => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

/** Fee in basis points (contract caps at 1000 = 10%). */
export const FEE_BPS = 500;

export function feeOf(payout: Gen): Gen {
  return (payout * BigInt(FEE_BPS)) / 10000n;
}

export function netOf(payout: Gen): Gen {
  return payout - feeOf(payout);
}
