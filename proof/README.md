# Proof directory

## What is captured

Sanitized extracts of observed GenLayer StudioNet receipts and state reads.
Nothing here is reconstructed, simulated, or hand-written. Every file was
produced by querying the live network.

| File | What it proves |
|---|---|
| `official-deployment.json` | The live deployment: address, deploy transaction, creator, finalization votes, and ABI shape (plus the superseded deployments) |
| `source-verification.json` | The deployed source is **byte-identical** to `contracts/AgentSheield.py` (v2), with the sha256 and the RPC calls to reproduce it |
| `lifecycle.json` | A complete **real** register → bond → file → `audit_claim` lifecycle on the v2 deployment: anchored evidence intake, bound liability terms, consensus-paid claim (3 agree / 0 idle) |
| `lifecycle-v1.json` | The same lifecycle on the superseded **v1** deployment — historical evidence (v1 intake did not require evidence anchors) |
| `empty-state-reads.json` | The pre-lifecycle state on the v1 deployment, which was **empty** — no agent, claim, dispute, or bond at deployment time |

## The official deployment

```text
network     studionet (GenLayer Studio Network)
address     0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48
deploy tx   0xa638860a035866b2c2d3595f5e4f23bdcb4bc38410a0426cfa5effacab2bab66
creator     0x5B3661C576c7001e6d6279C67F3779705d334c89
created     2026-10-09T15:54:45+00:00
status      FINALIZED, leader SUCCESS, 3 agree / 2 idle (idle cancelled after quorum)
ABI         20 methods - 6 view, 14 write, 1 payable
```

Studio: <https://studio.genlayer.com/?import-contract=0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48>
Explorer: <https://explorer-studio.genlayer.com/address/0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48>

The deploy receipt (`genlayer receipt 0xa638860a…ab2bab66 --status FINALIZED`)
shows the leader plus three validating nodes returning `execution_result
SUCCESS`; the two idle validators were cancelled once quorum was reached
(`error_code: CONSENSUS_VALIDATOR_QUORUM_REACHED`).

## Source verification

The deployed contract is **byte-identical** to `contracts/AgentSheeld.py`
(sha256 `142a59c3…623c18`, 33150 bytes, 683 lines). Verify it yourself in one
line:

```bash
curl -s -X POST https://explorer-studio.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48"]}' \
  | python3 -c 'import json,sys,base64; sys.stdout.buffer.write(base64.b64decode(json.load(sys.stdin)["result"]))' \
  | cmp - contracts/AgentSheild.py && echo byte-identical
```

What this version enforces on top of v1: `uri:`/`sha256:` evidence anchors at
intake (re-derived and consensus-echoed at audit, fail closed on mismatch),
per-claim liability tables bound at filing, an open-claims collateral freeze
against delist/retier, and dispute gating against stale, undisputable, and
repeated settlement.

The earlier **v1** deployment (`0x8c354C2a…31fbF`, sha256 `f45dde8c…6393b8`,
506 lines) is superseded; its addresses and receipts remain only as historical
evidence — see `superseded_deployments` in `official-deployment.json` and
`lifecycle-v1.json`.

## Consensus evidence (real, not mocked)

`lifecycle.json` records a full lifecycle on the **v2** deployment —
register → bond 2 GEN → file (evidence anchored with `uri:` + `sha256:`) →
`audit_claim` with a real LLM consensus round:

```text
register_agent  tx 0x04f5f4e618e8…b70b0  FINALIZED  SUCCESS
bond_agent      tx 0x0788e1befa6a…f59b7  FINALIZED  SUCCESS  (value 2 GEN)
file_claim      tx 0x0017a71ef1c7…94a5a  FINALIZED  SUCCESS  (claim 1, high, anchored)
audit_claim     tx 0xac1c5a062332…969b  FINALIZED  SUCCESS  (3 agree / 0 idle)
```

The `audit_claim` consensus receipt shows three validators re-running the LLM
consensus method and agreeing. The resulting on-chain state:

- claim 1 `status: paid`, `severity_ai: high`, `payout: 500`, `paid_out: 500`
  (high tier of the table bound at filing: `bound.high = 500`)
- LLM-written reason: *"Evidence cites transcript lines with embedded PII and
  third-party tracking GET, anchored by uri and sha256; violates PII-sharing
  and beyond-scope policies."*
- agent 1 stats: `bond_bal: 1999999999999999500` (2 GEN − 500 slashed),
  `valid: 1`, `total_paid: 500`
- after terminal resolution the collateral lock released: `open_claims: 0`,
  `frozen: false`

The earlier v1 run (`lifecycle-v1.json`, `audit_claim` tx `0xa81cfa7c…6be1c`,
3 agree / 2 idle, claim paid 500) is preserved as historical evidence.
Reproduce the v2 lifecycle with:

```bash
AGENTSHEILD=0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48 node scripts/lifecycle.mjs
```
