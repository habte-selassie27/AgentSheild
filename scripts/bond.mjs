#!/usr/bin/env node
/**
 * bond_agent with value — the genlayer CLI cannot send value (write always
 * sends 0), so payable calls go through genlayer-js.
 *
 * Usage:
 *   GL_KEYSTORE_JSON=/path/to/keystore GL_KEYSTORE_PASSWORD=... \
 *     node scripts/bond.mjs <contract> <agent_id> <value_wei>
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { Wallet } from "ethers";
import { createClient, createAccount, chains } from "genlayer-js";

const [contract, agentId, valueWei] = process.argv.slice(2);
if (!contract || !agentId || !valueWei) {
  console.error("usage: bond.mjs <contract> <agent_id> <value_wei>");
  process.exit(2);
}
const ksPath = process.env.GL_KEYSTORE_JSON;
const ksPass = process.env.GL_KEYSTORE_PASSWORD;
if (!ksPath || !ksPass) {
  console.error("Set GL_KEYSTORE_JSON and GL_KEYSTORE_PASSWORD (genlayer account export).");
  process.exit(2);
}

const wallet = await Wallet.fromEncryptedJson(readFileSync(ksPath, "utf8"), ksPass);
const client = createClient({
  chain: chains.studionet,
  account: createAccount(wallet.privateKey),
});
await client.initializeConsensusSmartContract();

const tx = await client.writeContract({
  address: contract,
  functionName: "bond_agent",
  args: [BigInt(agentId)],
  value: BigInt(valueWei),
});
console.log(`  bond transaction: ${tx}`);
execSync(
  `genlayer receipt ${tx} --status FINALIZED --retries 180 --interval 4000 | grep -q "execution_result: 'SUCCESS'"`,
  { stdio: ["ignore", "pipe", "inherit"], timeout: 180 * 6 * 1000 },
);
console.log(`  bond finalized: ${valueWei} wei bonded for agent ${agentId}`);
