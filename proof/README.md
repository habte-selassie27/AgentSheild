# Proof directory

## What is captured

Sanitized extracts of observed GenLayer StudioNet receipts and state reads.
Nothing here is reconstructed, simulated, or hand-written. Every file was
produced by querying the live network.

| File | What it proves |
|---|---|
| `official-deployment.json` | The live deployment: address, deploy transaction, creator, finalization votes, and ABI shape |
| `source-verification.json` | The deployed source is **byte-identical** to `contracts/AgentSheild.py`, with the sha256 and the RPC calls to reproduce it |
| `empty-state-reads.json` | The live state, which is **empty** — no agent, claim, dispute, or bond |

## The official deployment

```text
network     studionet (GenLayer Studio Network)
address     0xEc80b9C592282aF5cc0eC0aeC3b7cdfD03CE0E75
deploy tx   0xda146f423eba6e5f953e460f70a69041cb971a24970dd5e5c2b3cdc675f0f216
creator     0x5B3661C576c7001e6d6279C67F3779705d334c89
created     2026-10-08T05:18:55.794027+00:00
status      FINALIZED, leader SUCCESS, 3 agree / 2 idle
ABI         20 methods - 6 view, 14 write, 1 payable
```

Studio: <https://studio.genlayer.com/?import-contract=0xEc80b9C592282aF5cc0eC0aeC3b7cdfD03CE0E75>
Explorer: <https://explorer-studio.genlayer.com/address/0xEc80b9C592282aF5cc0eC0aeC3b7cdfD03CE0E75>

Two of five StudioNet validators were idle and cast no vote. Finalization
required three agreements and got exactly three, so the margin is the minimum
Studio permits. The leader and all three agreeing validators returned
`execution_result: 'SUCCESS'`.

## Source verification

The deployed contract is byte-identical to `contracts/AgentSheild.py`
(sha256 `f45dde8c…6393b8`, 23470 bytes, 506 lines). Verify it yourself in one
line:

```bash
curl -s -X POST https://explorer-studio.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0xEc80b9C592282aF5cc0eC0aeC3b7cdfD03CE0E75"]}' \
| python3 -c 'import json,sys,base64; sys.stdout.buffer.write(base64.b64decode(json.load(sys.stdin)["result"]))' \
| cmp - contracts/AgentSheild.py && echo byte-identical
```

## What is still missing

Consensus evidence: the deployment is live but unused, so no `audit_claim`
receipt exists yet. Direct Mode runs the leader function only and is not
consensus evidence. Produce the receipt with:

```bash
AGENTSHEILD_CONTRACT=0xEc80b9C592282aF5cc0eC0aeC3b7cdfD03CE0E75 scripts/smoke.sh --write
```

Then record the `audit_claim` transaction hash (status `FINALIZED`, consensus
`MAJORITY_AGREE`) in this directory.
