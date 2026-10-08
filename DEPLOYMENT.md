# AgentSheild Deployment

## Current repository status

| Item | State |
|---|---|
| Contract | `contracts/AgentSheild.py`, 506 lines, runner pinned in the header comment |
| Offline preflight | `scripts/preflight.py` — 32/32 checks pass |
| Direct Mode tests | `tests/direct/test_agentsheild.py` — leader-only, mocked LLM |
| LLM-resilience tests | `tests/test_normalizer.py` — no node required |
| Live deployment | `0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF` on StudioNet, deploy tx `0x8adc2d7f…ccc9f0cc`, `FINALIZED` |
| Source verification | deployed source **byte-identical** to `contracts/AgentSheild.py`, sha256 `f45dde8c…6393b8` |
| Consensus evidence | **captured** — `audit_claim` tx `0xa81cfa7c…6be1c`, FINALIZED, 3 agree / 2 idle; claim paid 500 (see `proof/lifecycle.json`) |

Direct Mode runs the leader function only. It is not consensus evidence.

The contract **is deployed** at `0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF`
on StudioNet and its on-chain source is byte-identical to this repository. A
full real lifecycle has already run on it: register → bond 2 GEN → file →
`audit_claim` consensus → paid claim (`severity_ai: high`, `payout: 500`).
All receipts are in `proof/`, with the consensus receipt in
`proof/lifecycle.json`.

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
address     0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF
deploy tx   0x8adc2d7f0ee14f96d1702f6b953a424356ca016fcaaed50af36e659bccc9f0cc
creator     0x5B3661C576c7001e6d6279C67F3779705d334c89
created     2026-10-08T14:12:11.920966+00:00
status      FINALIZED, leader SUCCESS, 5 agree / 0 idle
```

## Runtime smoke sequence

Every write below is a real transaction. The deterministic steps finalize
quickly; `audit_claim` runs full consensus and needs a longer poll.

### Setup

```bash
export AGENTSHEILD="0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF"

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
# 3. file. Length minimums and a valid tier are enforced before storage.
genlayer write "$AGENTSHEILD" file_claim --args 1 \
  "Agent leaked my email in a recommendation" \
  "Asked the agent for a dinner recipe and it included my full email address in the reply, plus an external tracking endpoint." \
  "Chat transcript lines 1-12: the reply embeds user@example.com and a GET request to a third-party analytics host." \
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
genlayer write "$AGENTSHEILD" delist_agent --args 1   # refunds remaining bond to the operator

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
python3 -m pytest tests/ -q     # 10 passed
```

## Before submitting

- [x] `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/AgentSheild.py` passes
- [x] `python3 scripts/preflight.py` passes (32/32)
- [x] `python3 -m pytest tests/ -q` passes (10)
- [x] deployed to a public test network (StudioNet `0x8c354C2a…31fbF`)
- [x] deployed source byte-identical, recorded in `proof/`
- [x] `audit_claim` receipt in `proof/lifecycle.json`: `FINALIZED`, 3 agree / 2 idle, claim paid
