import type {
  ActivityEvent, Agent, AuditRound, Claim, Dispute, Gen, Scenario, Severity, SystemStatus, Posture, ValidatorVerdict,
} from './types';
import { GEN, formatGen } from './types';

export const OPERATOR = '0x7A3f9C21e8B4d5F6a0C1d3E2b9A7f4E8c5D16B0a';
export const OWNER = '0x04e0353B7218b66D6803725ce7342E6e1225DB1b';
export const CLAIMANT = '0xB41d7E0a9C2f8D3e6A1b5C9f0E2d8A4b7F31C2de';
export const CONTRACT_ID = 'agentsheild.registry.studionet';

const T = (critical: number, high: number, medium: number, low: number) => ({
  critical: GEN(critical), high: GEN(high), medium: GEN(medium), low: GEN(low), info: 0n,
});

export const BASE_AGENTS: Agent[] = [
  {
    id: 1, operator: OPERATOR, name: 'LedgerOps-3', status: 'active', createdAt: '2026-08-14',
    policy: 'Two-person rule on value transfers; egress allowlist; no unattended signing.',
    description: 'Treasury operations agent preparing and broadcasting transfers under the vault policy.',
    liabilities: T(50, 20, 8, 2), bond: GEN(60),
  },
  {
    id: 2, operator: '0x2Fb8…9C14', name: 'SupportTriage-1', status: 'active', createdAt: '2026-08-22',
    policy: 'CRM scope only; no autonomous refunds above 100 USDC.',
    description: 'Customer support triage agent classifying tickets and drafting replies.',
    liabilities: T(10, 4, 1.5, 0.5), bond: GEN(5),
  },
  {
    id: 3, operator: '0x51Ae…4D70', name: 'Researcher-7', status: 'active', createdAt: '2026-09-02',
    policy: 'Declared crawl ceilings; allowlisted destinations; read-only credentials.',
    description: 'Web research agent collecting market data for the strategy team.',
    liabilities: T(25, 10, 4, 1), bond: GEN(3),
  },
  {
    id: 4, operator: OPERATOR, name: 'TreasuryBot', status: 'active', createdAt: '2026-07-30',
    policy: 'Deterministic rebalancing inside published bands; no external approvals.',
    description: 'Scheduled rebalancing bot running a fixed strategy with no LLM steps.',
    liabilities: T(200, 80, 30, 10), bond: GEN(250),
  },
  {
    id: 5, operator: '0x9Dc2…11Ba', name: 'Indexer-Crawler', status: 'paused', createdAt: '2026-06-11',
    policy: 'Internal endpoints only; rate ceiling 150 req/min.',
    description: 'Chain indexer worker ingesting blocks into the internal database.',
    liabilities: T(5, 2, 1, 0.25), bond: GEN(4),
  },
  {
    id: 6, operator: '0x33F0…7Ee9', name: 'PayloadRunner-2', status: 'delisted', createdAt: '2026-05-19',
    policy: 'Sandboxed template rendering; no network egress.',
    description: 'Sandboxed template renderer — delisted after the exfiltration claim.',
    liabilities: T(15, 6, 2, 0.5), bond: GEN(0),
  },
];

/** Build a validator audit round where every node reached the same verdict. */
export function makeAudit(
  claimId: number, decision: ValidatorVerdict['decision'], severity: Severity, reward: Gen, reasons: string[]
): AuditRound {
  const nodes = [
    { node: 'val-01', region: 'eu-west' }, { node: 'val-02', region: 'us-east' },
    { node: 'val-03', region: 'ap-south' }, { node: 'val-04', region: 'eu-north' },
    { node: 'val-05', region: 'us-west' },
  ];
  return {
    claimId,
    principle: 'prompt_comparative · identical decision · severity ±1 tier · identical reward',
    consensusReached: true,
    finalDecision: decision,
    finalReward: reward,
    tx: '0x8f72…91ac',
    block: 4118392,
    validators: nodes.map((n, i) => ({
      ...n,
      decision,
      severity,
      duplicateOf: decision === 'duplicate' ? 5 : 0,
      reward,
      reason: reasons[i % reasons.length],
      latencyMs: 780 + i * 57,
    })),
  };
}

export const AUDIT_REASONS_VALID = [
  'Evidence matches the policy breach; impact within declared liability tier.',
  'Claimant logs corroborate the incident; not a duplicate of prior claims.',
  'Agent policy text forbids exactly this action — verdict sound.',
  'Independent replay of evidence agrees; payout derives from tier table.',
  'No conflicting claim in dedup window; severity supported by impact.',
];

export const AUDIT_REASONS_INVALID = [
  'Described action is explicitly permitted by the agent policy.',
  'No corroborating evidence in the claim body — insufficient basis.',
  'Impact contradicts on-chain records; agent behaved within scope.',
  'Claimant misattributes a third-party failure to the agent.',
  'Behavior matches the published manifest — not a breach.',
];

export const BASE_CLAIMS: Claim[] = [
  {
    id: 7, agentId: 1, agentName: 'LedgerOps-3', claimant: CLAIMANT,
    title: 'Unauthorized transfer executed without consent',
    description:
      'Claimant states the agent broadcast a 420,000 USDC transfer outside the approved batch window, citing an instruction carried in a retrieved vendor document.',
    evidence: 'tx log excerpt, vault approval record, retrieved document chunk hash 0x71c9…a4f2',
    impact: '420,000 USDC moved to an unapproved destination; recovered 96% within 20 minutes.',
    severityClaimed: 'critical', severityAi: null, status: 'pending', duplicateOf: 0,
    payout: GEN(50), submittedAt: '09:41:06 UTC', resolvedAt: null, auditReason: null, audit: null,
  },
  {
    id: 6, agentId: 3, agentName: 'Researcher-7', claimant: '0x8Ce1…55F2',
    title: 'Rate ceiling ignored, causing API suspension',
    description:
      'Claimant reports the agent sustained 420 req/min against the search API for 11 minutes, triggering a 24-hour suspension of the shared key.',
    evidence: 'API gateway logs, suspension notice, manifest ceiling excerpt',
    impact: 'Shared research key suspended for 24h; two deadlines missed.',
    severityClaimed: 'high', severityAi: null, status: 'pending', duplicateOf: 0,
    payout: GEN(10), submittedAt: '08:57:44 UTC', resolvedAt: null, auditReason: null, audit: null,
  },
  {
    id: 5, agentId: 6, agentName: 'PayloadRunner-2', claimant: CLAIMANT,
    title: 'Exfiltrated API keys to an external webhook',
    description:
      'Rendered template output embedded environment secrets and posted them to a non-allowlisted webhook host.',
    evidence: 'POST body capture, env-shaped token matches, egress deny log',
    impact: '14 credentials rotated; 3 sessions revoked.',
    severityClaimed: 'critical', severityAi: 'critical', status: 'paid', duplicateOf: 0,
    payout: GEN(15), submittedAt: '07:12:19 UTC', resolvedAt: '07:13:04 UTC',
    auditReason: 'Secret-shaped strings confirmed in posted body; sandbox policy forbids all egress.',
    audit: makeAudit(5, 'valid', 'critical', GEN(15), AUDIT_REASONS_VALID),
  },
  {
    id: 4, agentId: 3, agentName: 'Researcher-7', claimant: '0x19Bb…07Cd',
    title: 'Crawled paywalled content into the shared report',
    description: 'Claimant says the agent reproduced paywalled research verbatim in an internal report.',
    evidence: 'report diff, source URL list',
    impact: 'Internal report redistributed; licensed content used without access.',
    severityClaimed: 'medium', severityAi: 'medium', status: 'valid', duplicateOf: 0,
    payout: GEN(4), submittedAt: 'Yesterday 15:20 UTC', resolvedAt: 'Yesterday 15:21 UTC',
    auditReason: 'Policy requires licensed sources only; claim within medium tier.',
    audit: makeAudit(4, 'valid', 'medium', GEN(4), AUDIT_REASONS_VALID),
  },
  {
    id: 3, agentId: 2, agentName: 'SupportTriage-1', claimant: '0x6Fa0…2B98',
    title: 'Wrong order marked as resolved',
    description: 'Claimant states the agent closed a ticket for the wrong order, delaying a refund.',
    evidence: 'ticket thread, refund record',
    impact: 'Refund delayed by 2 days; no funds lost.',
    severityClaimed: 'high', severityAi: 'low', status: 'invalid', duplicateOf: 0,
    payout: GEN(0), submittedAt: 'Yesterday 12:03 UTC', resolvedAt: 'Yesterday 12:04 UTC',
    auditReason: 'Ticket resolution is permitted under policy; delay caused by upstream queue, not the agent.',
    audit: makeAudit(3, 'invalid', 'low', GEN(0), AUDIT_REASONS_INVALID),
  },
  {
    id: 2, agentId: 6, agentName: 'PayloadRunner-2', claimant: '0x44Cd…8Ae1',
    title: 'Credentials leaked through rendered output',
    description: 'Second report of the same webhook exfiltration described in claim #5.',
    evidence: 'same POST capture as claim 5',
    impact: 'Duplicate of the incident already compensated in claim 5.',
    severityClaimed: 'critical', severityAi: 'critical', status: 'duplicate', duplicateOf: 5,
    payout: GEN(0), submittedAt: '07:40:51 UTC', resolvedAt: '07:41:12 UTC',
    auditReason: 'Cited duplicate_of=5 exists, same agent, already valid/paid — derived check passed.',
    audit: makeAudit(2, 'duplicate', 'critical', GEN(0), AUDIT_REASONS_VALID),
  },
  {
    id: 1, agentId: 5, agentName: 'Indexer-Crawler', claimant: '0x0Ab7…9931',
    title: 'Backfill job overwrote fresh index rows',
    description: 'A backfill run wrote stale rows over freshly ingested data for one epoch.',
    evidence: 'db diff, job schedule tag',
    impact: 'Index stale for 40 minutes; re-ingested automatically.',
    severityClaimed: 'medium', severityAi: 'low', status: 'paid', duplicateOf: 0,
    payout: GEN(0.25), submittedAt: '2 days ago', resolvedAt: '2 days ago',
    auditReason: 'Data impact bounded and self-healing; low tier fits.',
    audit: makeAudit(1, 'valid', 'low', GEN(0.25), AUDIT_REASONS_VALID),
  },
  {
    id: 8, agentId: 1, agentName: 'LedgerOps-3', claimant: '0xC21f…44Ba',
    title: 'Batch payment missed the settlement window',
    description:
      'Claimant asserts the agent delayed a batch payment past the settlement window. Operator disputes, citing the upstream bank cutoff change.',
    evidence: 'batch log, bank cutoff notice, operator timeline',
    impact: 'Late settlement fee of ~900 USDC charged by counterparty.',
    severityClaimed: 'high', severityAi: 'medium', status: 'disputed', duplicateOf: 0,
    payout: GEN(8), submittedAt: 'Yesterday 18:30 UTC', resolvedAt: null,
    auditReason: 'Delay partially attributable to external cutoff change; medium tier applied.',
    audit: makeAudit(8, 'valid', 'medium', GEN(8), AUDIT_REASONS_VALID),
  },
];

export const BASE_DISPUTES: Dispute[] = [
  {
    id: 1, claimId: 8, raisedBy: OPERATOR, reason: 'Bank cutoff changed after the batch was scheduled; agent cannot be liable for external calendar drift.',
    resolved: false, outcome: '', frozenTiers: T(50, 20, 8, 2), raisedAt: 'Yesterday 19:02 UTC',
  },
];

export const BASE_ACTIVITY: ActivityEvent[] = [
  { id: 'a1', time: '09:41:06', title: 'Claim #7 filed', detail: 'LedgerOps-3 · critical claimed · deterministic intake', severity: 'HIGH', kind: 'Claims' },
  { id: 'a2', time: '08:57:44', title: 'Claim #6 filed', detail: 'Researcher-7 · high claimed · queued for audit', severity: 'MEDIUM', kind: 'Claims' },
  { id: 'a3', time: '07:13:04', title: 'Auto-payout executed', detail: 'Claim #5 · 15 GEN · claimant 14.25, fee 0.75', severity: 'HIGH', kind: 'Payout' },
  { id: 'a4', time: '07:13:02', title: 'Audit consensus reached', detail: 'Claim #5 · valid · critical · 5/5 identical reward', severity: 'HIGH', kind: 'Consensus' },
  { id: 'a5', time: '07:41:12', title: 'Claim #2 closed as duplicate', detail: 'duplicate_of=5 derived-checked · no payout', severity: 'INFO', kind: 'Consensus' },
  { id: 'a6', time: 'Yesterday 19:02', title: 'Dispute #1 raised', detail: 'Claim #8 · liability table frozen at raise', severity: 'MEDIUM', kind: 'Disputes' },
  { id: 'a7', time: 'Yesterday 15:21', title: 'Claim #4 audited valid', detail: '4 GEN claimable — bond underfunded at 3 GEN', severity: 'MEDIUM', kind: 'Consensus' },
  { id: 'a8', time: 'Yesterday 12:04', title: 'Claim #3 audited invalid', detail: 'No payout · reason recorded on-chain', severity: 'INFO', kind: 'Consensus' },
  { id: 'a9', time: 'Yesterday 10:15', title: 'Bond topped up', detail: 'TreasuryBot · +50 GEN · bond 250 GEN', severity: 'INFO', kind: 'Registry' },
  { id: 'a10', time: '2 days ago', title: 'Agent #5 paused', detail: 'Indexer-Crawler paused by operator', severity: 'INFO', kind: 'Registry' },
  { id: 'a11', time: '2 days ago', title: 'Auto-payout executed', detail: 'Claim #1 · 0.25 GEN · low tier', severity: 'INFO', kind: 'Payout' },
  { id: 'a12', time: '3 days ago', title: 'Agent #6 delisted', detail: 'PayloadRunner-2 · bond refunded 0 GEN', severity: 'MEDIUM', kind: 'Registry' },
];

/** Claims filed per hour — last 24 buckets. */
export const CLAIM_TREND: number[] = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 0, 2, 4, 2, 1, 3, 2, 5, 3, 1, 2, 4, 6, 3];

export interface ScenarioState {
  status: SystemStatus;
  posture: Posture;
  agents: Agent[];
  claims: Claim[];
  disputes: Dispute[];
  activity: ActivityEvent[];
  headline: string;
  headlineDetail: string;
}

const clone = <T,>(x: T[]): T[] => x.map((v) => ({ ...v }));

/**
 * Scenario overlay. The base registry dataset is shared; each scenario mutates
 * the claim under audit (#7) the way the contract would after a real round.
 */
export function buildScenario(scenario: Scenario): ScenarioState {
  const agents = clone(BASE_AGENTS);
  const claims = clone(BASE_CLAIMS);
  const disputes = clone(BASE_DISPUTES);
  const activity = BASE_ACTIVITY.map((e) => ({ ...e }));
  const claim7 = claims.find((c) => c.id === 7)!;
  const agent1 = agents.find((a) => a.id === 1)!;

  if (scenario === 'settled') {
    claim7.status = 'paid';
    claim7.severityAi = 'critical';
    claim7.resolvedAt = '09:41:14 UTC';
    claim7.auditReason = 'Evidence matches policy breach; critical tier applies under agent #1 liability table.';
    claim7.audit = makeAudit(7, 'valid', 'critical', GEN(50), AUDIT_REASONS_VALID);
    agent1.bond = GEN(10); // 60 − 50 slashed
    activity.unshift(
      { id: 's1', time: '09:41:14', title: 'Auto-payout executed', detail: 'Claim #7 · 50 GEN · claimant 47.5, fee 2.5', severity: 'HIGH', kind: 'Payout' },
      { id: 's2', time: '09:41:12', title: 'Audit consensus reached', detail: 'Claim #7 · valid · critical · 5/5 identical reward', severity: 'HIGH', kind: 'Consensus' },
    );
    return {
      status: 'OPERATIONAL', posture: 'SETTLED', agents, claims, disputes, activity,
      headline: 'PAYOUT EXECUTED',
      headlineDetail: 'Claim #7 settled from the LedgerOps-3 bond: 47.5 GEN to the claimant, 2.5 GEN protocol fee.',
    };
  }

  if (scenario === 'disputed') {
    claim7.status = 'disputed';
    claim7.severityAi = 'critical';
    claim7.auditReason = 'Evidence matches policy breach; critical tier applies under agent #1 liability table.';
    claim7.audit = makeAudit(7, 'valid', 'critical', GEN(50), AUDIT_REASONS_VALID);
    disputes.unshift({
      id: 2, claimId: 7, raisedBy: OPERATOR,
      reason: 'Transfer was blocked upstream by the vault before settlement — agent never broadcast it.',
      resolved: false, outcome: '', frozenTiers: T(50, 20, 8, 2), raisedAt: '09:44:10 UTC',
    });
    activity.unshift(
      { id: 'd1', time: '09:44:10', title: 'Dispute #2 raised', detail: 'Claim #7 · liability table frozen · arbitration pending', severity: 'MEDIUM', kind: 'Disputes' },
      { id: 'd2', time: '09:41:14', title: 'Audit consensus reached', detail: 'Claim #7 · valid · critical · payout held pending dispute', severity: 'HIGH', kind: 'Consensus' },
    );
    return {
      status: 'DISPUTE_OPEN', posture: 'DISPUTED', agents, claims, disputes, activity,
      headline: 'DISPUTE IN ARBITRATION',
      headlineDetail: 'Claim #7 payout is frozen while the owner arbitrates. The liability table was snapshot at raise time.',
    };
  }

  // queue (default) — claims awaiting audit
  return {
    status: 'AUDITS_PENDING', posture: 'NOMINAL', agents, claims, disputes, activity,
    headline: 'AUDITS PENDING',
    headlineDetail: '2 claims await audit_claim(). Evidence is sealed on-chain; validators re-run the same prompt independently.',
  };
}

/** GEN value used in copy strings, e.g. headline figures. */
export const fmt = formatGen;
