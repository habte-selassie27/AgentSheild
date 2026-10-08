# AgentSheild — Frontend

Bonded AI-agent liability registry console for **AgentSheild** on **GenLayer**.
Agents register with a conduct policy, per-severity liability tiers and a GEN bond;
anyone can file a claim; validators reach LLM consensus on whether the agent actually
misbehaved; settlement pays out of the bond deterministically.

> Settlement is on-chain via the `agentsheild.registry` intelligent contract.
> This frontend is a read + trigger layer only (mock data + typed SDK stubs).

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5174
npm run build    # tsc + vite build → dist/
npm run preview  # serve dist/
npm run lint     # oxlint
```

## Stack

Vite 5 · React 19 · TypeScript · Tailwind CSS 3 · react-router-dom (HashRouter) ·
lucide-react · clsx

## Routes

| Route | Page | Contract surface |
| --- | --- | --- |
| `/` | Landing — claim path, capabilities | — |
| `/overview` | Registry overview — KPIs, pipeline, bonds | views |
| `/agents` | Agent registry — policy, tiers, bond, status actions | `bond_agent`, `pause/resume/delist_agent`, `update_liabilities` |
| `/claims` | Claims list + file-claim modal | `file_claim` |
| `/claims/:id` | Claim detail — evidence, payout math, audit, dispute | `claim_payout`, `raise_dispute` |
| `/audit` | Audit queue + validator consensus | `audit_claim` (only nondeterministic method) |
| `/disputes` | Frozen tiers + owner arbitration | `resolve_dispute`, `requeue_disputed` |
| `/activity` | Append-only event log | events |

Scenarios (topbar switcher): **QUEUE** (default, claim #7 pending), **SETTLED**
(claim #7 paid, bond reduced), **DISPUTED** (dispute open, tiers frozen).

## Structure

```
src/
  lib/
    types.ts     # domain types (Agent, Claim, Dispute, AuditRound, …), formatGen, fee helpers
    mock.ts      # seeded registry dataset + scenario overlays
    sdk.ts       # service layer — typed stubs mirroring AgentSheild.py, swap bodies for genlayer-js RPC
    shield.tsx   # app state provider: scenario, wallet, audit flow, registry writes
  components/
    Shell.tsx        # sidebar, topbar, scenario switcher, banners, footer
    Cards.tsx        # KPIs, bond gauge, pipeline, trend, feeds, claim cards, consensus
    StatusBadge.tsx  # claim/agent/severity status chips
    AuditModal.tsx   # staged audit_claim() run (memory → dedup → prompt → consensus → settle)
  pages/
    Landing · Overview · Agents · Claims · ClaimDetail · Audit · Disputes · Activity
```

## Notes

- Amounts are u256 atto-GEN; display uses `formatGen` (1e18 → GEN). Protocol fee is
  `FEE_BPS = 500` (5%, contract cap 1000 bps) via `feeOf` / `netOf`.
- Severities: `info < low < medium < high < critical`; audit decisions:
  `valid | invalid | duplicate`.
- `sdk.ts` is the single integration surface — replace the stub bodies with live RPC
  calls against `AgentSheild.py` without touching the UI.
