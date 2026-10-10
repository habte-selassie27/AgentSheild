# AgentSheild Deployment

## Current repository status

| Item | State |
|---|---|
| Contract | `contracts/AgentSheield.py`, 683 lines, runner pinned in the header comment |
| Offline preflight | `scripts/preflight.py` — 36/36 checks pass |
| Direct Mode tests | `tests/direct/test_agentsheild.py` — leader-only, mocked LLM (10 tests) |
| LLM-resilience tests | `tests/test_normalizer.py` — no node required (4 tests) |
| Live deployment | `0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48` on StudioNet, deploy tx `0xa638860a…ab2bab66`, `FINALIZED` (3 agree / 2 idle) |
| Source verification | deployed source **byte-identical** to `contracts/AgentSheield.py`, sha256 `142a59c3…623c18` (33150 bytes, 683 lines) |
| Consensus evidence | **captured on v2** — `audit_claim` tx `0xac1c5a06…969b`, FINALIZED, 3 agree / 0 idle; claim paid 500 (see `proof/lifecycle.json`) |

Direct Mode runs the leader function only. It is not consensus evidence.

The contract **is deployed** at `0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48`
on StudioNet, running source **byte-identical** to this repository
(sha256 `142a59c3…623c18`). `file_claim` requires embedded `uri:`/`sha256:`
evidence anchors, every claim binds its liability table at filing, and disputes
are gated against stale, undisputable, and repeated settlement.

A full real lifecycle has run on this deployment: register → bond 2 GEN →
file (anchored evidence) → `audit_claim` consensus (3 agree / 0 idle, claim
`high` paid `500`, LLM reason on-chain). All receipts are in `proof/`, with the
consensus receipt in `proof/lifecycle.json`. The earlier v1 receipts
(`0x8c354C2a…31fbF`) are preserved in `proof/lifecycle-v1.json`.

## Requirements

- GenLayer CLI (`npm install -g genlayer`) for deploy and CLI calls
- `genvm-lint` for static checks (`pip install genvm-linter`)
- `genlayer-test` for Direct Mode and integration tests
- An unlocked, funded account on the target network

## Install CLI

```bash
npm install -g genlayer
genlayer --version
```

## Select a network

```bash
genlayer network set studionet          # hosted, gasless, rate-limited
genlayer network set testnet-bradbury   # real network, funded accounts needed
genlayer network set localnet           # full GenVM via Docker
```

Studio enforces per-IP limits of 60 req/min, 1000 req/hr, 10000 req/day. For a
long smoke sequence, prefer localnet or a testnet. A `-32028` error means the
pending queue is full (32 in-flight per sender) — wait for receipts rather than
firing writes in parallel.

## Lint before deploying

```bash
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/AgentSheild.py
```

Expect `Lint passed` and `Validation passed` (20 methods: 6 view, 14 write).
The runner version in the `# { "Depends": ... }` header must match the network
you deploy to.

## Offline preflight

No network and no GenVM runtime required:

```bash
python3 scripts/preflight.py
```

This compiles the contract, checks imports, the single-consensus-boundary
invariant, the fail-closed settlement guards, the field truncation caps, and
exercises the pure normalization helpers against adversarial LLM output.

## Deploy

```bash
genlayer deploy --contract contracts/AgentSheild.py
genlayer schema "$AGENTSHEILD"        # confirm the ABI loaded
```

Record the address and the deploy transaction hash. They go in
`proof/official-deployment.json`.

For this repository that has already happened:

```text
address     0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48
deploy tx   0xa638860a035866b2c2d3595f5e4f23bdcb4bc38410a0426cfa5effacab2bab66
creator     0x5B3661C576c7001e6d6279C67F3779705d334c89
created     2026-10-09T15:54:45+00:00
status      FINALIZED, leader SUCCESS, 3 agree / 2 idle (idle cancelled after quorum)
ABI         20 methods - 6 view, 14 write, 1 payable
```

## Runtime smoke sequence

Every write below is a real transaction. The deterministic steps finalize
quickly; `audit_claim` runs full consensus and needs a longer poll.

### Setup

```bash
export AGENTSHEILD="0x9F9eBD0dD2fcd152EaEb30b80A2Bb1Cf7f961A48"

# 1. register an agent. Liabilities must descend critical >= high >= medium >= low.
genlayer write "$AGENTSHEILD" register_agent --args \
  "Shopping Agent" \
  "Never share user PII, never take actions beyond the user request, always cite the source of a price quote." \
  "Autonomous checkout assistant for a demo store" \
  1000 500 100 50
# -> returns agent_id (1 on a fresh contract)

# 2. bond 2 GEN. NOTE: the genlayer CLI has no --value flag (write always
#    sends value 0), so payable calls must go through genlayer-js:
node scripts/lifecycle.mjs          # registers, bonds 2 GEN, files, audits
# or, manually, with genlayer-js writeContract({ value: 2000000000000000000n })
```

### Claim intake

```bash
# 3. file. Length minimums, a valid tier, and evidence anchors (uri: link +
#    sha256: digest of the artifact) are enforced before storage. The digest
#    below is the sha256 of the referenced transcript artifact; recompute it
#    with `sha256sum` if you swap the evidence text.
genlayer write "$AGENTSHEILD" file_claim --args 1 \
  "Agent leaked my email in a recommendation" \
  "Asked the agent for a dinner recipe and it included my full email address in the reply, plus an external tracking endpoint." \
  "Chat transcript lines 1-12: the reply embeds user@example.com and a GET request to a third-party analytics host.
Artifact: uri:https://artifacts.agentsheild.example/incident-smoke-01.json sha256:78d6119aa4ccc1a61acefb81dd4c9ccfaa267ed7a4d42cc1e61ce40b2f081387" \
  "PII exposure of the end user without consent or disclosure." \
  high
# -> returns claim_id (1 on a fresh contract)
```

### Consensus

```bash
# 4. the only nondeterministic method
genlayer write "$AGENTSHEILD" audit_claim --args 1
# capture the transaction hash, then wait for consensus
genlayer receipt <audit_tx_hash> --status FINALIZED --retries 180 --interval 3000
```

Confirm all three of these in the receipt:

- `status_name: 'FINALIZED'`
- `execution_result: 'SUCCESS'`
- consensus reached quorum (`VALIDATOR_QUORUM_REACHED`; the recorded audit tx
  `0xa81cfa7c…6be1c` shows 3 `agree` votes, 2 idle cancelled after quorum),
  not a leader-only result

If validators reject the verdict, the transaction does not finalize, no state
changes, and the claim stays `pending`. Re-audit is free and permissionless, so
a failed attempt is not a dead end.

### Read back the consensus-bound amount

```bash
genlayer call "$AGENTSHEILD" get_claim       --args 1
genlayer call "$AGENTSHEILD" get_agent_stats --args 1
```

Check `payout` against the liability table by hand. For a `high` verdict on the
table above it must be `500`, and `total_paid` must have risen by `500` while
`bond_bal` fell by `500 + fee`. A `SUCCESS` receipt on a `valid` claim is
itself evidence that the amount was consensus-bound — the contract reverts with
`"Payout not bound by consensus"` otherwise.

### Lifecycle and dispute

```bash
# operator lifecycle
genlayer write "$AGENTSHEILD" pause_agent  --args 1
genlayer write "$AGENTSHEILD" resume_agent --args 1
genlayer write "$AGENTSHEILD" delist_agent --args 1   # refunds remaining bond; blocked while claims stay open (frozen)

# dispute: claimant or agent operator only
genlayer write "$AGENTSHEILD" raise_dispute     --args 1 "severity is understated"
# -> returns dispute_id

# operator or owner: back to pending for a fresh consensus round
genlayer write "$AGENTSHEILD" requeue_disputed  --args 1

# owner only: direct arbitration, permanently recorded
genlayer write "$AGENTSHEILD" resolve_dispute   --args 1 valid high
```

Do not call `delist_agent` before capturing the payout evidence: it zeroes
`bond_bal` and leaves any unclaimed `valid` claim unclaimable.

### All read methods

```bash
genlayer call "$AGENTSHEILD" get_agent         --args 1
genlayer call "$AGENTSHEILD" get_claim         --args 1
genlayer call "$AGENTSHEILD" get_agent_claims  --args 1 0 20
genlayer call "$AGENTSHEILD" get_pending_queue --args 10
genlayer call "$AGENTSHEILD" get_agent_stats   --args 1
genlayer call "$AGENTSHEILD" get_dispute       --args 1
```

`get_agent_claims` and `get_pending_queue` return JSON-encoded arrays as
plain strings, not typed lists. Parse them with `json.loads`.

## Automated equivalent

`scripts/smoke.sh` performs the same sequence and prints every transaction hash.

```bash
# read-only, against the live deployment
AGENTSHEILD_CONTRACT="$AGENTSHEILD" scripts/smoke.sh

# full lifecycle, spends fees, runs real consensus
# (bond_agent is payable, so export the keystore for the genlayer-js bond step)
export GL_KEYSTORE_JSON=/path/to/exported-keystore.json
export GL_KEYSTORE_PASSWORD=...
AGENTSHEILD_CONTRACT="$AGENTSHEILD" scripts/smoke.sh --write

# also resolve the dispute (requires the owner account)
ARBITRATE=1 AGENTSHEILD_CONTRACT="$AGENTSHEILD" scripts/smoke.sh --write
```

It refuses to run write mode unless the configured network is a real test
network and the named account is active and unlocked.

## Tests

```bash
# offline: pure helpers against adversarial LLM output, no node needed
python3 -m pytest tests/test_normalizer.py -v

# Direct Mode: leader-only, mocked LLM, ~30ms per test
python3 -m pytest tests/direct -v

# everything
python3 -m pytest tests/ -q     # 14 passed
```

## Before submitting

- [x] `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/AgentSheield.py` passes
- [x] `python3 scripts/preflight.py` passes (36/36)
- [x] `python3 -m pytest tests/ -q` passes (14)
- [x] deployed to a public test network (StudioNet `0x9F9eBD0d…961A48`, deploy tx `0xa638860a…ab2bab66`, 3 agree / 2 idle)
- [x] deployed source byte-identical to `contracts/AgentSheield.py`, recorded in `proof/`
- [x] `audit_claim` receipt in `proof/lifecycle.json`: `FINALIZED`, 3 agree / 0 idle, claim paid 500
