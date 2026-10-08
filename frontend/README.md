# AgentSheild — Frontend

Bonded AI-agent liability registry console for **AgentSheild** on **GenLayer**.
Agents register with a conduct policy, per-severity liability tiers and a GEN bond;
anyone can file a claim; validators reach LLM consensus on whether the agent actually
misbehaved; settlement pays out of the bond deterministically.

> Settlement is on-chain via the deployed GenLayer intelligent contract. Reads run
> **live** against StudioNet (no mock data); writes are signed by the connected
> wallet via MetaMask + the GenLayer snap.

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

Every page reads live on-chain state from the contract `0x8c354C2a60E53ea7DA4D2eBC658eec2f75531fbF`
on StudioNet — there are no mock values. Connect a wallet to send real transactions.

## Structure

```
src/
  lib/
    types.ts     # domain types (Agent, Claim, Dispute, ActivityEvent), formatGen
    genlayer.ts  # genlayer-js client + network/contract config
    sdk.ts       # live reads/writes against AgentSheild.py via genlayer-js
    shield.tsx   # app state provider: live registry, wallet, audit flow, writes
  components/
    Shell.tsx        # sidebar, topbar, scenario switcher, banners, footer
    Cards.tsx        # KPIs, bond gauge, pipeline, trend, feeds, claim cards, consensus
    StatusBadge.tsx  # claim/agent/severity status chips
    AuditModal.tsx   # staged audit_claim() run (memory → dedup → prompt → consensus → settle)
  pages/
    Landing · Overview · Agents · Claims · ClaimDetail · Audit · Disputes · Activity
```

## Notes

- Amounts are u256 wei (atto-GEN); display uses `formatGen` (1e18 → GEN). The
  contract's fee bps is not exposed by any view, so the UI shows the gross tier
  payout and lets the contract apply its fee on-chain.
- Severities: `info < low < medium < high < critical`; audit decisions:
  `valid | invalid | duplicate`.
- `sdk.ts` is the single integration surface: it enumerates the registry via
  `get_agent` / `get_claim` / `get_pending_queue` / `get_dispute` and sends writes
  through `genlayer-js`. Set `VITE_AGENTSHEILD_CONTRACT` to target another deployment.
