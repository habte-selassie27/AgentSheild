/**
 * GenLayer client + network configuration.
 *
 * Reads run against the public StudioNet RPC (no signer required). Writes are
 * signed by the injected wallet via genlayer-js's MetaMask integration.
 */
import { createClient, chains } from 'genlayer-js';

/** Official StudioNet deployment of contracts/AgentSheild.py (source byte-verified). */
export const DEFAULT_CONTRACT = '0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const CONTRACT = (env.VITE_AGENTSHEILD_CONTRACT || DEFAULT_CONTRACT) as `0x${string}`;

export interface NetworkInfo {
  chain: string;
  chainId: number;
  rpc: string;
  explorer: string;
  contract: string;
}

export const NETWORK: NetworkInfo = {
  chain: chains.studionet.name,
  chainId: chains.studionet.id,
  rpc: chains.studionet.rpcUrls.default.http[0],
  explorer: 'https://explorer-studio.genlayer.com',
  contract: CONTRACT,
};

export const explorerAddress = (addr: string) => `${NETWORK.explorer}/address/${addr}`;
export const explorerTx = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;

/** Singleton client. Reads hit the RPC directly; writes route through window.ethereum. */
export const client = createClient({ chain: chains.studionet });

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
