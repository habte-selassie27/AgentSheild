import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AUDIT_REASONS_VALID, buildScenario, makeAudit } from './mock';
import { NETWORK, sdk } from './sdk';
import type {
  ActivityEvent, Agent, Claim, Dispute, Gen, Posture, Scenario, Severity, SystemStatus,
} from './types';
import { GEN, SEVERITY_INDEX, feeOf, netOf } from './types';

export const AUDIT_STEPS = [
  'Copy Agent + Claim into memory',
  'Build bounded dedup context (last 60 claims)',
  'Validators re-run the audit prompt',
  'prompt_comparative consensus · decision · tier · reward',
  'Deterministic settlement & auto-pay',
];

interface ShieldState {
  scenario: Scenario;
  setScenario(s: Scenario): void;
  simulate(s: Scenario): void;

  status: SystemStatus;
  posture: Posture;
  headline: string;
  headlineDetail: string;

  agents: Agent[];
  claims: Claim[];
  disputes: Dispute[];
  activity: ActivityEvent[];
  loading: boolean;

  lastCheckSec: number;
  autoRefresh: boolean;
  setAutoRefresh(v: boolean): void;

  wallet: string | null;
  connectWallet(): void;
  disconnectWallet(): void;

  auditing: boolean;
  auditStep: number;
  auditClaimId: number | null;
  runAudit(claimId: number): void;

  bondAgent(agentId: number, amount: Gen): void;
  cycleAgentStatus(agentId: number): void;
  fileClaim(input: { agentId: number; title: string; description: string; evidence: string; impact: string; severity: Severity }): void;
  claimPayout(claimId: number): void;
  raiseDisputeLocal(claimId: number, reason: string): void;
  resolveDisputeLocal(disputeId: number, outcome: 'upheld' | 'overturned', severity: Severity): void;

  refresh(): void;
}

const Ctx = createContext<ShieldState | null>(null);
export const useShield = () => useContext(Ctx)!;

function clock(): string {
  return new Date().toISOString().slice(11, 19);
}

export function ShieldProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenarioState] = useState<Scenario>('queue');
  const [base, setBase] = useState(() => buildScenario('queue'));
  const [loading, setLoading] = useState(true);
  const [lastCheckSec, setLastCheckSec] = useState(4);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [wallet, setWallet] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [auditClaimId, setAuditClaimId] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  // Initial dataset load through the SDK stubs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await sdk.getScenario('queue');
      if (cancelled) return;
      setBase(s);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => setLastCheckSec((s) => (s >= 59 ? 0 : s + 1)), 1000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const push = useCallback((e: Omit<ActivityEvent, 'id' | 'time'>) => {
    setBase((b) => ({
      ...b,
      activity: [{ ...e, id: Math.random().toString(36).slice(2), time: clock() }, ...b.activity].slice(0, 60),
    }));
  }, []);

  const simulate = useCallback((s: Scenario) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setAuditing(false);
    setAuditStep(0);
    setAuditClaimId(null);
    setScenarioState(s);
    setBase(buildScenario(s));
    setLastCheckSec(0);

    if (s === 'settled') {
      push({ title: 'State: settled', detail: 'Claim #7 shown post-settlement (50 GEN paid)', severity: 'INFO', kind: 'System' });
    } else if (s === 'disputed') {
      push({ title: 'State: disputed', detail: 'Dispute #2 open — arbitration pending', severity: 'MEDIUM', kind: 'Disputes' });
    } else {
      push({ title: 'State: audit queue', detail: '2 claims pending audit_claim()', severity: 'INFO', kind: 'System' });
    }
  }, [push]);

  const runAudit = useCallback((claimId: number) => {
    if (auditing) return;
    setAuditing(true);
    setAuditStep(0);
    setAuditClaimId(claimId);

    AUDIT_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setAuditStep(i), i * 750));
    });

    const total = AUDIT_STEPS.length * 750 + 500;
    timers.current.push(
      window.setTimeout(() => {
        setAuditing(false);
        setAuditStep(AUDIT_STEPS.length);
        setLastCheckSec(0);

        setBase((b) => {
          const claim = b.claims.find((c) => c.id === claimId);
          if (!claim) return b;
          const agent = b.agents.find((a) => a.id === claim.agentId);
          if (!agent) return b;

          const tier = claim.severityClaimed;
          const reward = agent.liabilities[tier];
          const underfunded = agent.bond < reward;
          const paid = !underfunded && reward > 0n;
          const decision = 'valid' as const;
          const audit = makeAudit(claimId, decision, tier, reward, AUDIT_REASONS_VALID);

          const claims = b.claims.map((c) =>
            c.id === claimId
              ? {
                  ...c,
                  severityAi: tier,
                  status: paid ? ('paid' as const) : ('valid' as const),
                  resolvedAt: clock() + ' UTC',
                  auditReason: `Evidence matches the declared breach; ${tier} tier under agent #${agent.id} liability table.`,
                  audit,
                }
              : c
          );

          const agents = paid
            ? b.agents.map((a) => (a.id === agent.id ? { ...a, bond: a.bond - reward } : a))
            : b.agents;

          const ev: ActivityEvent[] = [
            {
              id: Math.random().toString(36).slice(2), time: clock(),
              title: paid ? 'Auto-payout executed' : 'Valid claim queued for payout',
              detail: paid
                ? `Claim #${claimId} · ${reward / 10n ** 18n} GEN · claimant ${netOf(reward) / 10n ** 18n}, fee ${feeOf(reward) / 10n ** 18n}`
                : `Claim #${claimId} · ${reward / 10n ** 18n} GEN claimable — bond underfunded`,
              severity: 'HIGH', kind: 'Payout',
            },
            {
              id: Math.random().toString(36).slice(2), time: clock(),
              title: 'Audit consensus reached',
              detail: `Claim #${claimId} · ${decision} · ${tier} · 5/5 identical reward`,
              severity: 'HIGH', kind: 'Consensus',
            },
          ];

          return {
            ...b,
            claims,
            agents,
            activity: [...ev, ...b.activity].slice(0, 60),
            headline: paid ? 'PAYOUT EXECUTED' : 'AUDITED — VALID',
            headlineDetail: paid
              ? `Claim #${claimId} settled from the ${agent.name} bond: ${netOf(reward) / 10n ** 18n} GEN to the claimant, ${feeOf(reward) / 10n ** 18n} GEN protocol fee.`
              : `Claim #${claimId} is valid but the bond cannot cover ${reward / 10n ** 18n} GEN — payout becomes claimable when the operator tops up.`,
          };
        });
      }, total),
    );
  }, [auditing, push]);

  const bondAgent = useCallback((agentId: number, amount: Gen) => {
    void sdk.bondAgent(agentId, amount);
    setBase((b) => ({
      ...b,
      agents: b.agents.map((a) => (a.id === agentId ? { ...a, bond: a.bond + amount } : a)),
    }));
    const a = base.agents.find((x) => x.id === agentId);
    push({ title: 'Bond topped up', detail: `${a?.name ?? `Agent #${agentId}`} · +${amount / 10n ** 18n} GEN`, severity: 'INFO', kind: 'Registry' });
  }, [base.agents, push]);

  const cycleAgentStatus = useCallback((agentId: number) => {
    setBase((b) => ({
      ...b,
      agents: b.agents.map((a) => {
        if (a.id !== agentId) return a;
        const next: Agent['status'] = a.status === 'active' ? 'paused' : a.status === 'paused' ? 'delisted' : 'active';
        void sdk.setAgentStatus(agentId, next);
        push({ title: `Agent #${agentId} ${next}`, detail: `${a.name} · status → ${next}`, severity: next === 'delisted' ? 'MEDIUM' : 'INFO', kind: 'Registry' });
        return { ...a, status: next };
      }),
    }));
  }, [push]);

  const fileClaim = useCallback((input: { agentId: number; title: string; description: string; evidence: string; impact: string; severity: Severity }) => {
    void sdk.fileClaim(input.agentId, input.title);
    const agent = base.agents.find((a) => a.id === input.agentId);
    const cid = Math.max(...base.claims.map((c) => c.id)) + 1;
    const claim: Claim = {
      id: cid, agentId: input.agentId, agentName: agent?.name ?? `Agent #${input.agentId}`,
      claimant: wallet ?? '0xB41d…C2de', title: input.title, description: input.description,
      evidence: input.evidence, impact: input.impact, severityClaimed: input.severity,
      severityAi: null, status: 'pending', duplicateOf: 0,
      payout: agent ? agent.liabilities[input.severity] : 0n,
      submittedAt: clock() + ' UTC', resolvedAt: null, auditReason: null, audit: null,
    };
    setBase((b) => ({ ...b, claims: [claim, ...b.claims] }));
    push({ title: `Claim #${cid} filed`, detail: `${agent?.name ?? 'agent'} · ${input.severity} claimed · deterministic intake`, severity: 'HIGH', kind: 'Claims' });
  }, [base.agents, wallet, push]);

  const resolveDisputeLocal = useCallback((disputeId: number, outcome: 'upheld' | 'overturned', severity: Severity) => {
    void sdk.resolveDispute(disputeId, outcome, severity);
    setBase((b) => {
      const d = b.disputes.find((x) => x.id === disputeId);
      if (!d) return b;
      return {
        ...b,
        disputes: b.disputes.map((x) =>
          x.id === disputeId ? { ...x, resolved: true, outcome: outcome === 'upheld' ? 'valid' : 'invalid' } : x
        ),
        claims: b.claims.map((c) =>
          c.id === d.claimId
            ? {
                ...c,
                status: outcome === 'upheld' ? 'valid' : 'invalid',
                severityAi: severity,
                resolvedAt: clock() + ' UTC',
                auditReason: `Arbitration ${outcome} — ${severity} tier confirmed by owner.`,
              }
            : c
        ),
      };
    });
    push({ title: `Dispute #${disputeId} resolved`, detail: `${outcome} · severity → ${severity}`, severity: 'MEDIUM', kind: 'Disputes' });
  }, [push]);

  const claimPayout = useCallback((claimId: number) => {
    void sdk.claimPayout(claimId);
    setBase((b) => {
      const c = b.claims.find((x) => x.id === claimId);
      if (!c || c.status !== 'valid') return b;
      const agent = b.agents.find((a) => a.id === c.agentId);
      const reward = agent ? agent.liabilities[c.severityAi ?? c.severityClaimed] : c.payout;
      if (!agent || agent.bond < reward) return b;
      return {
        ...b,
        claims: b.claims.map((x) =>
          x.id === claimId ? { ...x, status: 'paid', payout: reward, resolvedAt: clock() + ' UTC' } : x
        ),
        agents: b.agents.map((a) => (a.id === c.agentId ? { ...a, bond: a.bond - reward } : a)),
        headline: 'PAYOUT EXECUTED',
        headlineDetail: `Claim #${claimId} settled from the ${agent.name} bond: ${netOf(reward) / 10n ** 18n} GEN to the claimant, ${feeOf(reward) / 10n ** 18n} GEN protocol fee.`,
      };
    });
    push({ title: `Claim #${claimId} paid`, detail: 'claim_payout() · bond → claimant + fee', severity: 'INFO', kind: 'Payout' });
  }, [push]);

  const raiseDisputeLocal = useCallback((claimId: number, reason: string) => {
    void sdk.raiseDispute(claimId, reason);
    setBase((b) => {
      const c = b.claims.find((x) => x.id === claimId);
      const agent = c ? b.agents.find((a) => a.id === c.agentId) : undefined;
      if (!c || !agent) return b;
      const id = Math.max(0, ...b.disputes.map((d) => d.id)) + 1;
      const dispute: Dispute = {
        id, claimId, raisedBy: wallet ?? '0xB41d…C2de', reason,
        resolved: false, outcome: 'open', frozenTiers: { ...agent.liabilities },
        raisedAt: clock() + ' UTC',
      };
      return {
        ...b,
        disputes: [dispute, ...b.disputes],
        claims: b.claims.map((x) => (x.id === claimId ? { ...x, status: 'disputed' } : x)),
        status: 'DISPUTE_OPEN',
        posture: 'DISPUTED',
        headline: 'DISPUTE OPENED',
        headlineDetail: `Claim #${claimId} is frozen for arbitration — liability tiers snapshotted at raise time.`,
      };
    });
    push({ title: `Dispute raised on claim #${claimId}`, detail: `${reason} · tiers frozen`, severity: 'HIGH', kind: 'Disputes' });
  }, [wallet, push]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await sdk.getScenario(scenario);
    setBase(s);
    setLastCheckSec(0);
    setLoading(false);
  }, [scenario]);

  const value: ShieldState = {
    scenario,
    setScenario: setScenarioState,
    simulate,
    status: base.status,
    posture: base.posture,
    headline: base.headline,
    headlineDetail: base.headlineDetail,
    agents: base.agents,
    claims: base.claims,
    disputes: base.disputes,
    activity: base.activity,
    loading,
    lastCheckSec,
    autoRefresh,
    setAutoRefresh,
    wallet,
    connectWallet: () => { void sdk.connectWallet().then(setWallet); },
    disconnectWallet: () => setWallet(null),
    auditing,
    auditStep,
    auditClaimId,
    runAudit,
    bondAgent,
    cycleAgentStatus,
    fileClaim,
    claimPayout,
    raiseDisputeLocal,
    resolveDisputeLocal,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { NETWORK };

export function severityLabel(s: Severity): string {
  return s.toUpperCase();
}

export function severityRank(s: Severity): number {
  return SEVERITY_INDEX[s];
}

export { GEN };
