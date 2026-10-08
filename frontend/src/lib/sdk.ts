/**
 * AgentSheild SDK — service layer between UI and the GenLayer intelligent
 * contract (contracts/AgentSheild.py).
 *
 * Every function is a typed stub returning the local dataset with realistic
 * latency. To go live, replace the bodies with genlayer-js calls against the
 * deployed registry (see NETWORK / CONTRACT_ID below) — the signatures mirror
 * the contract's 20 methods, so page components will not change.
 */
import { BASE_ACTIVITY, BASE_AGENTS, BASE_CLAIMS, BASE_DISPUTES, CONTRACT_ID, buildScenario } from './mock';
import type { ActivityEvent, Agent, Claim, Dispute, Gen, Scenario, Severity } from './types';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface NetworkInfo {
  chain: 'GenLayer Studionet';
  chainId: number;
  rpc: string;
  explorer: string;
  contract: string;
  contractId: string;
  connected: boolean;
}

export const NETWORK: NetworkInfo = {
  chain: 'GenLayer Studionet',
  chainId: 42069,
  rpc: 'https://studio.genlayer.com:8545',
  explorer: 'https://explorer-studio.genlayer.com',
  contract: '0x9c1F2b7Ae4D38e5C20A7fB31dE0a44C5B6e91A2f',
  contractId: CONTRACT_ID,
  connected: true,
};

export interface TxReceipt {
  ok: boolean;
  tx: string;
  block: number;
}

export const sdk = {
  /* ---- views ---- */

  async getAgents(): Promise<Agent[]> {
    await delay(90);
    return BASE_AGENTS.map((a) => ({ ...a }));
  },

  async getClaims(): Promise<Claim[]> {
    await delay(120);
    return BASE_CLAIMS.map((c) => ({ ...c }));
  },

  async getDisputes(): Promise<Dispute[]> {
    await delay(80);
    return BASE_DISPUTES.map((d) => ({ ...d }));
  },

  async getActivity(): Promise<ActivityEvent[]> {
    await delay(60);
    return BASE_ACTIVITY.map((e) => ({ ...e }));
  },

  async getScenario(scenario: Scenario) {
    await delay(140);
    return buildScenario(scenario);
  },

  async connectWallet(): Promise<string> {
    await delay(300);
    return '0x7C4b…9A21';
  },

  async disconnectWallet(): Promise<void> {
    await delay(120);
  },

  /* ---- writes (deterministic, staged locally) ---- */

  async registerAgent(name: string): Promise<{ ok: boolean; aid: number }> {
    await delay(300);
    void name;
    return { ok: true, aid: 7 };
  },

  async bondAgent(agentId: number, amount: Gen): Promise<TxReceipt> {
    await delay(350);
    void agentId;
    void amount;
    return { ok: true, tx: '0x21ac…8f09', block: 4118405 };
  },

  async setAgentStatus(agentId: number, status: Agent['status']): Promise<TxReceipt> {
    await delay(250);
    void agentId;
    void status;
    return { ok: true, tx: '0x77b1…2c5d', block: 4118406 };
  },

  async fileClaim(agentId: number, title: string): Promise<{ ok: boolean; cid: number }> {
    await delay(400);
    void agentId;
    void title;
    return { ok: true, cid: 9 };
  },

  /** The only nondeterministic method: LLM audit + deterministic settlement. */
  async auditClaim(claimId: number): Promise<TxReceipt & { decision: string }> {
    await delay(900);
    void claimId;
    return { ok: true, tx: '0x8f72…91ac', block: 4118392, decision: 'valid' };
  },

  async claimPayout(claimId: number): Promise<TxReceipt> {
    await delay(400);
    void claimId;
    return { ok: true, tx: '0x5c19…7ab3', block: 4118393 };
  },

  async raiseDispute(claimId: number, reason: string): Promise<{ ok: boolean; did: number }> {
    await delay(350);
    void claimId;
    void reason;
    return { ok: true, did: 3 };
  },

  async resolveDispute(disputeId: number, outcome: string, severity: Severity): Promise<TxReceipt> {
    await delay(450);
    void disputeId;
    void outcome;
    void severity;
    return { ok: true, tx: '0x9a3e…1d77', block: 4118410 };
  },
};
