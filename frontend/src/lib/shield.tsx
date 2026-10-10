import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NETWORK, explorerTx } from './genlayer';
import { sdk, type Registry, shortAddr } from './sdk';
import type {
  ActivityEvent, Agent, AgentStatus, Claim, Decision, Dispute, Gen, Posture, Severity, SystemStatus,
} from './types';
import { SEVERITY_INDEX, formatGen } from './types';

export const AUDIT_STEPS = [
  'Snapshot agent + claim into validator memory',
  'Build bounded dedup context (last 60 claims)',
  'Each validator re-runs the identical audit prompt',
  'prompt_comparative consensus · decision · tier · reward',
  'Deterministic settlement & auto-pay from the bond',
];

interface ShieldState {
  loading: boolean;
  error: string | null;
  notice: string | null;
  lastTx: string | null;
  clearNotice(): void;

  agents: Agent[];
  claims: Claim[];
  disputes: Dispute[];
  activity: ActivityEvent[];

  status: SystemStatus;
  posture: Posture;
  headline: string;
  headlineDetail: string;
  pending: Claim[];
  openDisputes: Dispute[];
  totalBond: Gen;

  lastCheckSec: number;
  autoRefresh: boolean;
  setAutoRefresh(v: boolean): void;
  refresh(): void;

  account: string | null;
  walletLabel: string | null;
  connecting: boolean;
  connectWallet(): void;
  disconnectWallet(): void;

  auditing: boolean;
  auditStep: number;
  auditClaimId: number | null;
  runAudit(claimId: number): void;

  bondAgent(agentId: number, amount: Gen): void;
  setAgentStatus(agentId: number, status: AgentStatus): void;
  fileClaim(input: {
    agentId: number; title: string; description: string; evidence: string; impact: string; severity: Severity;
  }): Promise<boolean>;
  claimPayout(claimId: number): void;
  raiseDispute(claimId: number, reason: string): void;
  resolveDispute(disputeId: number, outcome: Decision, severity: Severity): void;
  requeueDisputed(claimId: number): void;
}

const Ctx = createContext<ShieldState | null>(null);
export const useShield = () => useContext(Ctx)!;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function deriveActivity(claims: Claim[], disputes: Dispute[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const c of claims) {
    const base = { id: `cl-${c.id}`, kind: 'Claims' as const };
    if (c.status === 'pending') {
      events.push({ ...base, title: `Claim #${c.id} filed`, detail: `${c.agentName} · ${c.severityClaimed} claimed · awaiting audit`, severity: 'INFO' });
    } else if (c.status === 'paid') {
      events.push({ id: `cl-${c.id}`, title: `Claim #${c.id} paid`, detail: `${formatGen(c.payout)} GEN paid from ${c.agentName} bond`, severity: 'HIGH', kind: 'Payout' });
    } else if (c.status === 'valid') {
      events.push({ id: `cl-${c.id}`, title: `Claim #${c.id} audited valid`, detail: `${c.severityAi ?? c.severityClaimed} · ${formatGen(c.payout)} GEN claimable`, severity: 'MEDIUM', kind: 'Consensus' });
    } else if (c.status === 'invalid') {
      events.push({ id: `cl-${c.id}`, title: `Claim #${c.id} audited invalid`, detail: c.auditReason ?? 'no payout', severity: 'INFO', kind: 'Consensus' });
    } else if (c.status === 'duplicate') {
      events.push({ id: `cl-${c.id}`, title: `Claim #${c.id} closed as duplicate`, detail: `duplicate_of = #${c.duplicateOf}`, severity: 'INFO', kind: 'Consensus' });
    } else if (c.status === 'disputed') {
      events.push({ id: `cl-${c.id}`, title: `Claim #${c.id} disputed`, detail: c.auditReason ?? 'payout frozen for arbitration', severity: 'MEDIUM', kind: 'Disputes' });
    }
  }
  for (const d of disputes) {
    events.push({
      id: `dsp-${d.id}`,
      title: `Dispute #${d.id} ${d.resolved ? `resolved ${d.outcome}` : 'open'}`,
      detail: `Claim #${d.claimId} · ${d.reason}`,
      severity: d.resolved ? 'INFO' : 'MEDIUM',
      kind: 'Disputes',
    });
  }
  return events;
}

export function ShieldProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastCheckSec, setLastCheckSec] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [auditClaimId, setAuditClaimId] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const load = useCallback(async (silent: boolean): Promise<Registry | null> => {
    if (!silent) setLoading(true);
    try {
      const r = await sdk.loadRegistry();
      setAgents(r.agents);
      setClaims(r.claims);
      setDisputes(r.disputes);
      setError(null);
      setLastCheckSec(0);
      return r;
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => { void load(false); }, [load]);

  // Silent reconnect to an already-authorized wallet.
  useEffect(() => {
    void sdk.getAccounts().then((accs) => { if (accs?.length) setAccount(accs[0]); });
  }, []);

  // Follow wallet account switches.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (...args: never[]) => {
      const accs = args[0] as unknown as string[] | undefined;
      setAccount(accs?.length ? accs[0] : null);
    };
    eth.on('accountsChanged', onAccounts);
    return () => eth.removeListener?.('accountsChanged', onAccounts);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => setLastCheckSec((s) => (s >= 59 ? 0 : s + 1)), 1000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const refresh = useCallback(() => { void load(false); }, [load]);

  const pollUntil = useCallback(async (done: (r: Registry) => boolean, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await delay(4000);
      const r = await load(true);
      if (r && done(r)) return true;
    }
    return false;
  }, [load]);

  const requireAccount = useCallback((): string => {
    if (!account) throw new Error('Connect a wallet first — writes are signed by the injected wallet.');
    return account;
  }, [account]);

  /** Send a transaction, wait for the on-chain effect, then resync reads. */
  const applyWrite = useCallback(async (
    label: string,
    send: (account: string) => Promise<string>,
    done?: (r: Registry) => boolean,
    timeoutMs = 90000,
  ): Promise<boolean> => {
    let acc: string;
    try {
      acc = requireAccount();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      return false;
    }
    try {
      setNotice(`${label}: confirm in your wallet…`);
      const hash = await send(acc);
      setLastTx(hash);
      setNotice(`${label}: submitted · ${hash.slice(0, 12)}… — waiting for consensus`);
      const ok = done ? await pollUntil(done, timeoutMs) : false;
      await load(true);
      setNotice(
        done
          ? ok
            ? `${label}: confirmed on-chain`
            : `${label}: still processing — refresh in a moment`
          : `${label}: submitted`,
      );
      return true;
    } catch (e) {
      setNotice(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }, [load, pollUntil, requireAccount]);

  const runAudit = useCallback((claimId: number) => {
    if (auditing) return;
    setAuditing(true);
    setAuditStep(0);
    setAuditClaimId(claimId);
    const tick = window.setInterval(() => {
      setAuditStep((s) => (s >= AUDIT_STEPS.length - 1 ? s : s + 1));
    }, 5000);
    timers.current.push(tick);

    void (async () => {
      await applyWrite(
        `audit_claim(${claimId})`,
        (acc) => sdk.auditClaim(claimId, acc),
        (r) => {
          const c = r.claims.find((x) => x.id === claimId);
          return !!c && c.status !== 'pending';
        },
        300000,
      );
      window.clearInterval(tick);
      setAuditStep(AUDIT_STEPS.length);
      setAuditing(false);
    })();
  }, [applyWrite, auditing]);

  const bondAgent = useCallback((agentId: number, amount: Gen) => {
    void applyWrite(
      `bond_agent(#${agentId})`,
      (acc) => sdk.bondAgent(agentId, amount, acc),
      (r) => (r.agents.find((a) => a.id === agentId)?.bond ?? 0n) > 0n,
    );
  }, [applyWrite]);

  const setAgentStatus = useCallback((agentId: number, status: AgentStatus) => {
    void applyWrite(
      `${status}_agent(#${agentId})`,
      (acc) => sdk.setAgentStatus(agentId, status, acc),
      (r) => r.agents.find((a) => a.id === agentId)?.status === status,
    );
  }, [applyWrite]);

  const fileClaim = useCallback((input: {
    agentId: number; title: string; description: string; evidence: string; impact: string; severity: Severity;
  }) => applyWrite(
      `file_claim(agent #${input.agentId})`,
      (acc) => sdk.fileClaim(input, acc),
      (r) => r.claims.some((c) => c.title === input.title && c.agentId === input.agentId),
    ), [applyWrite]);

  const claimPayout = useCallback((claimId: number) => {
    void applyWrite(
      `claim_payout(#${claimId})`,
      (acc) => sdk.claimPayout(claimId, acc),
      (r) => r.claims.find((c) => c.id === claimId)?.status === 'paid',
    );
  }, [applyWrite]);

  const raiseDispute = useCallback((claimId: number, reason: string) => {
    void applyWrite(
      `raise_dispute(#${claimId})`,
      (acc) => sdk.raiseDispute(claimId, reason, acc),
      (r) => r.disputes.some((d) => d.claimId === claimId && !d.resolved),
    );
  }, [applyWrite]);

  const resolveDispute = useCallback((disputeId: number, outcome: Decision, severity: Severity) => {
    void applyWrite(
      `resolve_dispute(#${disputeId})`,
      (acc) => sdk.resolveDispute(disputeId, outcome, severity, acc),
      (r) => r.disputes.find((d) => d.id === disputeId)?.resolved === true,
    );
  }, [applyWrite]);

  const requeueDisputed = useCallback((claimId: number) => {
    void applyWrite(
      `requeue_disputed(#${claimId})`,
      (acc) => sdk.requeueDisputed(claimId, acc),
      (r) => r.claims.find((c) => c.id === claimId)?.status === 'pending',
    );
  }, [applyWrite]);

  const pending = useMemo(() => claims.filter((c) => c.status === 'pending'), [claims]);
  const openDisputes = useMemo(() => disputes.filter((d) => !d.resolved), [disputes]);
  const totalBond = useMemo(() => agents.reduce((n, a) => n + a.bond, 0n), [agents]);
  const activity = useMemo(() => deriveActivity(claims, disputes), [claims, disputes]);

  const status: SystemStatus = openDisputes.length ? 'DISPUTE_OPEN' : pending.length ? 'AUDITS_PENDING' : 'OPERATIONAL';
  const posture: Posture = openDisputes.length ? 'DISPUTED' : claims.some((c) => c.status === 'paid') ? 'SETTLED' : 'NOMINAL';

  const headline =
    status === 'DISPUTE_OPEN' ? 'DISPUTE OPEN'
    : status === 'AUDITS_PENDING' ? 'AUDITS PENDING'
    : 'REGISTRY OPERATIONAL';
  const headlineDetail =
    status === 'DISPUTE_OPEN'
      ? `${openDisputes.length} claim${openDisputes.length === 1 ? '' : 's'} frozen for owner arbitration.`
      : status === 'AUDITS_PENDING'
        ? `${pending.length} claim${pending.length === 1 ? '' : 's'} await audit_claim() on ${NETWORK.chain}.`
        : `Live state of ${NETWORK.contract.slice(0, 10)}… on ${NETWORK.chain}.`;

  const value: ShieldState = {
    loading, error, notice, lastTx, clearNotice: () => setNotice(null),
    agents, claims, disputes, activity,
    status, posture, headline, headlineDetail, pending, openDisputes, totalBond,
    lastCheckSec, autoRefresh, setAutoRefresh, refresh,
    account,
    walletLabel: account ? shortAddr(account) : null,
    connecting,
    connectWallet: () => {
      setConnecting(true);
      void sdk.connectWallet()
        .then((acc) => { setAccount(acc); setNotice('Wallet connected'); })
        .catch((e) => setNotice(e instanceof Error ? e.message : String(e)))
        .finally(() => setConnecting(false));
    },
    disconnectWallet: () => { setAccount(null); setNotice('Wallet disconnected locally'); },
    auditing, auditStep, auditClaimId, runAudit,
    bondAgent, setAgentStatus, fileClaim, claimPayout, raiseDispute, resolveDispute, requeueDisputed,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { NETWORK, explorerTx };
export function severityRank(s: Severity): number {
  return SEVERITY_INDEX[s];
}
