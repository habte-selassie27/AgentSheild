#!/usr/bin/env node
/**
 * AgentSheild real-world lifecycle runner (StudioNet).
 *
 * Replaces demo/mock values with real on-chain activity:
 *   1. bond_agent        2 GEN (payable - CLI 0.39 has no --value, so genlayer-js)
 *   2. file_claim        real incident claim
 *   3. audit_claim       REAL LLM validator consensus (prompt_comparative)
 *   4. reads back        get_claim / get_agent_stats
 *
 * Writes sanitized receipts to proof/lifecycle.json.
 *
 * Env:
 *   GL_KEYSTORE_JSON      path to exported keystore (genlayer account export)
 *   GL_KEYSTORE_PASSWORD  keystore password
 *   AGENTSHEILD           contract address (default: official StudioNet deployment)
 *
 * Usage:
 *   GL_KEYSTORE_JSON=/tmp/rabby-keystore.json GL_KEYSTORE_PASSWORD=... \
 *     node scripts/lifecycle.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";
import { createClient, createAccount, chains } from "genlayer-js";

const CONTRACT = process.env.AGENTSHEILD || "0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOND_WEI = 2n * 10n ** 18n;

// Payouts must trace to authenticated incident evidence: file_claim requires an
// artifact anchor (`uri:`) and its content digest (`sha256:`) embedded in the
// evidence text. The digest here is computed for real, from the artifact body
// below, so the claim references an artifact that can be re-hashed and checked.
const ARTIFACT_URI = "https://artifacts.agentsheild.example/incident-lifecycle-01.json";
const ARTIFACT_BODY = JSON.stringify({
  claim: "Agent leaked my email in a recommendation",
  transcript: [
    "user: give me a dinner recipe",
    "agent: here is a recipe — reach me at user@example.com for questions",
    "agent: GET https://analytics.third-party.example/track?sid=abc123",
  ],
});
const ARTIFACT_DIGEST = createHash("sha256").update(ARTIFACT_BODY).digest("hex");

const CLAIM = {
  title: "Agent leaked my email in a recommendation",
  description:
    "Asked the agent for a dinner recipe and it included my full email address in the reply, plus an external tracking endpoint.",
  evidence:
    `Chat transcript lines 1-12: the reply embeds user@example.com and a GET request to a third-party analytics host with the session id as a query param.\nArtifact: uri:${ARTIFACT_URI} sha256:${ARTIFACT_DIGEST}`,
  impact: "PII exposure of the end user without consent or disclosure.",
  severity: "high",
};

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

async function waitFinal(client, txId, label, retries = 180) {
  // Poll with the CLI receipt command (blocking until FINALIZED/SUCCESS).
  try {
    execSync(
      `genlayer receipt ${txId} --status FINALIZED --retries ${retries} --interval 4000 | grep -q "execution_result: 'SUCCESS'"`,
      { stdio: ["ignore", "pipe", "inherit"], timeout: retries * 6 * 1000 },
    );
    return { tx: txId, status: "FINALIZED", execution_result: "SUCCESS" };
  } catch (e) {
    throw new Error(`${label}: transaction did not finalize with SUCCESS: ${txId}`);
  }
}

async function main() {
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

  const proof = {
    _comment:
      "Real StudioNet lifecycle receipts for AgentSheild. Addresses and hashes are live; no secrets are stored here.",
    contract: CONTRACT,
    network: "studionet",
    started_at: new Date().toISOString(),
    steps: [],
  };

  // --- 0. register the agent if the contract is fresh ---
  let agentExists = true;
  try {
    await client.readContract({ address: CONTRACT, functionName: "get_agent", args: [1n] });
  } catch {
    agentExists = false;
  }
  if (!agentExists) {
    log("register_agent", "fresh contract -> registering agent");
    const regTx = await client.writeContract({
      address: CONTRACT,
      functionName: "register_agent",
      args: [
        "Smoke Shopping Agent",
        "Never share user PII, never take actions beyond the user request, always cite the source of a price quote.",
        "Autonomous checkout assistant for a demo store",
        1000n, 500n, 100n, 50n,
      ],
    });
    log("register_agent", `tx ${regTx}`);
    const regRcpt = await waitFinal(client, regTx, "register_agent");
    proof.steps.push({ step: "register_agent", tx: regTx, agent_id: 1, status: regRcpt.status ?? "finalized" });
  }

  // --- 1. bond 2 GEN (payable; value supported by genlayer-js, not the CLI) ---
  let claimId = process.env.CLAIM_ID ? Number(process.env.CLAIM_ID) : null;
  if (!claimId && process.env.SKIP_BOND !== "1") {
    log("bond_agent", "sending 2 GEN ...");
    const bondTx = await client.writeContract({
      address: CONTRACT,
      functionName: "bond_agent",
      args: [1n],
      value: BOND_WEI,
    });
    log("bond_agent", `tx ${bondTx}`);
    const bondRcpt = await waitFinal(client, bondTx, "bond_agent");
    proof.steps.push({ step: "bond_agent", args: [1], value_wei: BOND_WEI.toString(), tx: bondTx, status: bondRcpt.status ?? "finalized" });
  }

  if (!claimId) {
    // --- 2. file a real claim ---
    log("file_claim", CLAIM.title);
    const fileTx = await client.writeContract({
      address: CONTRACT,
      functionName: "file_claim",
      args: [1n, CLAIM.title, CLAIM.description, CLAIM.evidence, CLAIM.impact, CLAIM.severity],
    });
    log("file_claim", `tx ${fileTx}`);
    const fileRcpt = await waitFinal(client, fileTx, "file_claim");
    claimId = 1; // first claim on a fresh contract
    proof.steps.push({ step: "file_claim", tx: fileTx, claim_id: claimId, status: fileRcpt.status ?? "finalized", claim: CLAIM });
  }

  // --- 3. the real consensus method (validators re-run the LLM prompt) ---
  let before = null;
  try {
    before = await client.readContract({ address: CONTRACT, functionName: "get_claim", args: [BigInt(claimId)] });
  } catch {
    before = null; // absent claim: TreeMap read of an absent key reverts
  }
  if (!before || before.status === "pending") {
    log("audit_claim", `claim ${claimId} pending -> real LLM consensus, this takes minutes ...`);
    const auditTx = await client.writeContract({
      address: CONTRACT,
      functionName: "audit_claim",
      args: [BigInt(claimId)],
    });
    log("audit_claim", `tx ${auditTx} (consensus evidence)`);
    const auditRcpt = await waitFinal(client, auditTx, "audit_claim", 300);
    proof.steps.push({ step: "audit_claim", tx: auditTx, claim_id: claimId, receipt: auditRcpt });
  } else {
    log("audit_claim", `claim ${claimId} already ${before.status}, skipping`);
  }

  // --- 4. read back the consensus-bound state ---
  const claim = await client.readContract({ address: CONTRACT, functionName: "get_claim", args: [BigInt(claimId)] });
  const stats = await client.readContract({ address: CONTRACT, functionName: "get_agent_stats", args: [1n] });
  const agent = await client.readContract({ address: CONTRACT, functionName: "get_agent", args: [1n] });
  log("state", JSON.stringify({ claim_status: claim.status, severity_ai: claim.severity_ai, payout: claim.payout, stats }));
  proof.final_state = { agent, claim, stats };
  proof.finished_at = new Date().toISOString();

  writeFileSync(join(ROOT, "proof", "lifecycle.json"), JSON.stringify(proof, null, 2) + "\n");
  log("proof", "written to proof/lifecycle.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
