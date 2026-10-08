# Proof directory

## What is captured

Sanitized extracts of observed GenLayer StudioNet receipts and state reads.
Nothing here is reconstructed, simulated, or hand-written. Every file was
produced by querying the live network.

| File | What it proves |
|---|---|
| `official-deployment.json` | The live deployment: address, deploy transaction, creator, finalization votes, and ABI shape |
| `source-verification.json` | The deployed source is **byte-identical** to `contracts/AgentSheild.py`, with the sha256 and the RPC calls to reproduce it |
| `empty-state-reads.json` | The pre-lifecycle state, which was **empty** — no agent, claim, dispute, or bond at deployment time |
| `lifecycle.json` | A complete **real** register → bond → file → audit lifecycle, including the `audit_claim` consensus receipt (3 agree / 2 idle) and the resulting paid claim |

## The official deployment

```text
network     studionet (GenLayer Studio Network)
address     0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF
deploy tx   0x8adc2d7f0ee14f96d1702f6b953a424356ca016fcaaed50af36e659bccc9f0cc
creator     0x5B3661C576c7001e6d6279C67F3779705d334c89
created     2026-10-08T14:12:11.920966+00:00
status      FINALIZED, leader SUCCESS, 5 agree / 0 idle
ABI         20 methods - 6 view, 14 write, 1 payable
```

Studio: <https://studio.genlayer.com/?import-contract=0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF>
Explorer: <https://explorer-studio.genlayer.com/address/0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF>

All five StudioNet validators agreed on the deployment.

## Source verification

The deployed contract is byte-identical to `contracts/AgentSheild.py`
(sha256 `f45dde8c…6393b8`, 23470 bytes, 506 lines). Verify it yourself in one
line:

```bash
curl -s -X POST https://explorer-studio.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF"]}' \
| python3 -c 'import json,sys,base64; sys.stdout.buffer.write(base64.b64decode(json.load(sys.stdin)["result"]))' \
| cmp - contracts/AgentSheild.py && echo byte-identical
```

## Consensus evidence (real, not mocked)

`lifecycle.json` records the first full lifecycle on the official contract:

```text
register_agent  tx 0x32f412189a3c…0c7641a  FINALIZED  SUCCESS
bond_agent      tx 0xd1407d2da514…c1971    FINALIZED  SUCCESS  (value 2 GEN)
file_claim      tx 0x42ff3201b171…cdafd    FINALIZED  SUCCESS  (claim 1, high)
audit_claim     tx 0xa81cfa7cdd9c…6be1c    FINALIZED  SUCCESS  (3 agree / 2 idle)
```

The `audit_claim` consensus receipt shows validators re-running the LLM
consensus method (`policy:prd-mistral` primary / `openai/gpt-5.4` secondary).
The resulting on-chain state:

- claim 1 `status: paid`, `severity_ai: high`, `payout: 500` (high liability)
- LLM-written reason: *"Agent violated policy by exposing user PII (email) and embedding an unauthorized tracking endpoint without consent."*
- agent 1 stats: `bond_bal: 1999999999999999500` (2 GEN − 500 slashed), `valid: 1`, `total_paid: 500`

Reproduce with:

```bash
CLAIM_ID=1 AGENTSHEILD=0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF node scripts/lifecycle.mjs
```
