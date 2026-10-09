# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""AgentSheild: bonded AI-agent liability registry. Agents post a GEN bond
and a conduct policy; users file incident claims; GenLayer validators reach
LLM consensus on whether the claim is valid; valid claims slash the agent's
bond and pay out. Payout math is deterministic."""
from dataclasses import dataclass
from genlayer import *
from datetime import datetime, timezone
import json
# NOTE: no top-level gl.evm / contract-interface blocks here on purpose.
# Studio builds the ABI by importing this module; anything touching versioned
# SDK namespaces at import time breaks schema load. The EOA payout interface
# is therefore defined lazily inside _send (runtime only, never import time).
_SEV = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
_DECISIONS = ("valid", "invalid", "duplicate")
_SHA256 = "0123456789abcdef"
def _evidence_anchors(evidence: object) -> tuple:
    """Extract the two tamper-evident anchors the claimant must embed in the
    evidence text: `uri:` (where the artifact lives) and `sha256:` (its digest).
    Pure: leader and every validator derive the same anchors from the same
    stored string. Enables payouts to be traced to authenticated incident
    evidence instead of free-form prose."""
    s = str(evidence if evidence is not None else "")
    def _after(tag: str) -> str:
        i = s.find(tag)
        if i < 0:
            return ""
        j = k = i + len(tag)
        while k < len(s) and s[k] not in (" ", "\n", "\t", ",", ";"):
            k += 1
        return s[j:k]
    return (_after("uri:"), _after("sha256:"))
def _sha256_ok(d: object) -> bool:
    s = str(d or "").strip().lower()
    return len(s) == 64 and all(ch in _SHA256 for ch in s)
def _coerce_sev(v: object) -> str:
    s = str(v if v is not None else "info").strip().lower()
    return s if s in _SEV else "info"
def _coerce_u(v: object) -> u256:
    try:
        n = int(str(v).strip())
    except Exception:
        return u256(0)
    return u256(n) if n >= 0 else u256(0)
def _clean(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    t = raw.replace("```json", "").replace("```", "").strip()
    a, b = t.find("{"), t.rfind("}")
    if a >= 0 and b > a:
        t = t[a:b + 1]
    try:
        d = json.loads(t)
    except Exception:
        return {}
    return d if isinstance(d, dict) else {}
def _norm(raw: object) -> dict:  # pure: runs on leader + every validator
    d = _clean(raw)
    dec = str(d.get("decision", "")).strip().lower()
    if dec not in _DECISIONS:  # tolerate is_valid/is_duplicate style outputs
        if d.get("is_duplicate") is True:
            dec = "duplicate"
        elif d.get("is_valid") is False or d.get("in_scope") is False:
            dec = "invalid"
        elif d.get("is_valid") is True:
            dec = "valid"
        else:
            dec = "invalid"
    return {"decision": dec, "severity": _coerce_sev(d.get("severity", "info")),
            "duplicate_of": _coerce_u(d.get("duplicate_of", 0)),
            "reason": str(d.get("reason", ""))[:280]}
def _tier_payout(rw: tuple, sev: object) -> int:
    """Max liability the bond pays for a severity tier. Pure: leader and every
    validator derive it from the same table, so `prompt_comparative` can bind
    the exact GEN amount even when severity is only tier-tolerant. Independent
    of `decision` so deterministic downgrades (hallucinated duplicate -> valid)
    stay inside the consensus-bound amount."""
    s = _coerce_sev(sev)
    if s == "critical":
        return int(rw[0])
    if s == "high":
        return int(rw[1])
    if s == "medium":
        return int(rw[2])
    if s == "low":
        return int(rw[3])
    return 0
def _now() -> u256:
    """Transaction timestamp: the GenVM clock is pinned to the tx datetime, so
    leader and validators read the same value. There is no block context."""
    return u256(int(datetime.now(timezone.utc).timestamp()))
@allow_storage
@dataclass
class Agent:
    id: u256
    operator: Address
    name: str
    policy: str
    description: str
    liability_critical: u256
    liability_high: u256
    liability_medium: u256
    liability_low: u256
    bond_bal: u256
    status: str  # active | paused | delisted
    created_at: u256
    # Collateral lock: any pending or disputed claim on this agent holds it.
    # While open_claims > 0 the bond cannot be delisted/withdrawn and the live
    # liability table cannot be retiered; payout math reads the per-claim
    # bound table instead, so the terms that price a claim survive operator
    # writes, requeues and arbitration until final resolution.
    open_claims: u256
    frozen: bool
@allow_storage
@dataclass
class Claim:
    id: u256
    agent_id: u256
    claimant: Address
    title: str
    description: str
    evidence: str
    impact: str
    severity_claimed: str
    severity_ai: str
    status: str  # pending|valid|paid|invalid|duplicate|disputed
    duplicate_of: u256  # 0 = none
    payout: u256
    submitted_at: u256
    resolved_at: u256
    audit_reason: str
    # Amount actually delivered to the claimant so far. Settlement always nets
    # against this: a funded claim re-disputed and re-resolved cannot be paid
    # twice for the same incident (repeated-settlement guard).
    paid_out: u256
    # Liability/stake terms bound when the claim was filed. Validators settle
    # against this snapshot, so the operator cannot retier what a pending
    # claim pays — not mid-flight (filing freezes the live table), not between
    # the audit and a dispute, not through requeues — until final resolution.
    bound_critical: u256
    bound_high: u256
    bound_medium: u256
    bound_low: u256
@allow_storage
@dataclass
class Dispute:
    id: u256
    claim_id: u256
    raised_by: Address
    reason: str
    resolved: bool
    outcome: str
    # True only when a dispute reached a terminal arbitration. A requeue closes
    # the dispute WITHOUT settling the refundable stake, so the claim's
    # collateral lock stays in force; a bare `resolved` close here would let
    # the operator unlock mid-flight, which is exactly the trap a requeue is
    # for.
    settled: bool
    # Liability table in force when the dispute was raised. Arbitration pays
    # from this snapshot, never the agent's live table, so an operator cannot
    # retier mid-dispute to change what an arbitration is worth.
    liability_critical: u256
    liability_high: u256
    liability_medium: u256
    liability_low: u256
class AgentSheild(gl.Contract):
    owner: Address
    fee_bps: u256
    next_agent_id: u256
    next_claim_id: u256
    next_dispute_id: u256
    agents: TreeMap[u256, Agent]
    claims: TreeMap[u256, Claim]
    disputes: TreeMap[u256, Dispute]
    agent_claim_counts: TreeMap[u256, u256]
    agent_claim_index: TreeMap[str, u256]  # "aid:idx" -> cid
    claimant_claim_counts: TreeMap[Address, u256]
    claimant_claim_index: TreeMap[str, u256]  # "addr:idx" -> cid
    def __init__(self):
        self.owner = gl.message.sender_address
        self.fee_bps = u256(200)
        self.next_agent_id = u256(1)
        self.next_claim_id = u256(1)
        self.next_dispute_id = u256(1)
    def _liability_for_bound(self, c: Claim, sev: str) -> u256:
        """Payout math reads the per-claim table bound at file_claim — never the
        operator-adjustable live table — so a retier mid-resolution cannot move
        the stakes of pending claims."""
        s = _coerce_sev(sev)
        if s == "critical":
            return c.bound_critical
        if s == "high":
            return c.bound_high
        if s == "medium":
            return c.bound_medium
        if s == "low":
            return c.bound_low
        return u256(0)
    def _open_dispute_for(self, claim_id: u256) -> u256:
        """Id of the dispute currently riding a claim, or 0 if none. Keeps a
        claim from collecting a second dispute while one is still open."""
        for i in range(1, int(self.next_dispute_id)):
            d = self.disputes.get(u256(i))
            if d is not None and d.claim_id == claim_id and not d.resolved:
                return u256(i)
        return u256(0)
    def _release(self, aid: u256) -> None:
        a = self.agents[aid]
        if int(a.open_claims) > 0:
            a.open_claims = u256(int(a.open_claims) - 1)
            if a.open_claims == u256(0):
                a.frozen = False
            self.agents[aid] = a
    def _settle(self, c: Claim) -> None:
        """Terminal release after audit/ arbitration/settle paths."""
        if c.status in ("valid", "paid", "invalid", "duplicate"):
            self._release(c.agent_id)
    def _liability_for(self, aid: u256, sev: str) -> u256:
        a = self.agents[aid]
        s = _coerce_sev(sev)
        if s == "critical":
            return a.liability_critical
        if s == "high":
            return a.liability_high
        if s == "medium":
            return a.liability_medium
        if s == "low":
            return a.liability_low
        return u256(0)
    def _append(self, aid: u256, cid: u256, claimant: Address) -> None:
        ai = self.agent_claim_counts.get(aid, u256(0))
        self.agent_claim_index[f"{int(aid)}:{int(ai)}"] = cid
        self.agent_claim_counts[aid] = ai + u256(1)
        ci = self.claimant_claim_counts.get(claimant, u256(0))
        self.claimant_claim_index[f"{str(claimant)}:{int(ci)}"] = cid
        self.claimant_claim_counts[claimant] = ci + u256(1)
    def _send(self, to: Address, amount: u256) -> None:
        # Lazy interface: evaluated at payout runtime, never at import/schema.
        @gl.evm.contract_interface
        class _To:
            class View:
                pass
            class Write:
                pass
        _To(to).emit_transfer(value=amount)

    def _pay(self, aid: u256, claimant: Address, amount: u256) -> bool:
        if amount == u256(0):
            return False
        a = self.agents[aid]
        if a.bond_bal < amount:
            return False
        fee = (int(amount) * int(self.fee_bps)) // 10000
        to_claimant = int(amount) - fee
        a.bond_bal = u256(int(a.bond_bal) - int(amount))
        self.agents[aid] = a
        if to_claimant > 0:
            self._send(claimant, u256(to_claimant))
        if fee > 0:
            self._send(self.owner, u256(fee))
        return True
    def _deliver(self, c: Claim, due: u256) -> bool:
        """Net-settle `due` to the claimant: only the portion above what this
        claim already paid out. Guarantees one incident never settles
        twice — arbitration over an already-funded claim pays only a
        genuine top-up, and a re-audit after requeue cannot re-fire the
        original transfer."""
        net = int(due) - int(c.paid_out)
        if net > 0:
            if not self._pay(c.agent_id, c.claimant, u256(net)):
                return False
            c.paid_out = u256(int(c.paid_out) + net)
            return True
        return True
    def _summaries(self, aid: u256, exclude: u256) -> str:
        n = int(self.agent_claim_counts.get(aid, u256(0)))
        lines: list[str] = []
        for i in range(max(0, n - 60), n):
            if len(lines) >= 20:
                break
            cid = self.agent_claim_index.get(f"{int(aid)}:{i}", u256(0))
            if cid == u256(0) or cid == exclude:
                continue
            c = self.claims[cid]
            if c.status in ("valid", "paid"):
                sev = c.severity_ai if c.severity_ai else c.severity_claimed
                lines.append(f"[{int(cid)}] {c.title} | {sev}")
        return "\n".join(lines) if lines else "None"
    @gl.public.write
    def register_agent(self, name: str, policy: str, description: str,
                       liability_critical: u256, liability_high: u256,
                       liability_medium: u256, liability_low: u256) -> u256:
        if not name.strip() or not policy.strip():  # [EXPECTED] bad input
            raise gl.vm.UserError("Name and policy required")
        vals = (int(liability_critical), int(liability_high), int(liability_medium), int(liability_low))
        if any(v < 0 for v in vals):
            raise gl.vm.UserError("Liabilities must be >= 0")
        if not (vals[0] >= vals[1] >= vals[2] >= vals[3]):
            raise gl.vm.UserError("Liabilities must descend critical>=high>=medium>=low")
        aid = self.next_agent_id
        self.agents[aid] = Agent(aid, gl.message.sender_address, name[:120],
            policy[:4000], description[:2000], liability_critical, liability_high,
            liability_medium, liability_low, u256(0), "active", _now(),
            u256(0), False)
        self.agent_claim_counts[aid] = u256(0)
        self.next_agent_id = aid + u256(1)
        return aid
    @gl.public.write.payable
    def bond_agent(self, agent_id: u256) -> None:
        if agent_id not in self.agents:  # [EXPECTED]
            raise gl.vm.UserError("Agent not found")
        a = self.agents[agent_id]
        if a.operator != gl.message.sender_address:
            raise gl.vm.UserError("Only operator bonds")
        if a.status != "active":
            raise gl.vm.UserError("Agent not active")
        if gl.message.value == u256(0):
            raise gl.vm.UserError("Send GEN to bond")
        a.bond_bal = u256(int(a.bond_bal) + int(gl.message.value))
        self.agents[agent_id] = a
    @gl.public.write
    def pause_agent(self, agent_id: u256) -> None:
        a = self.agents[agent_id]
        if a.operator != gl.message.sender_address:
            raise gl.vm.UserError("Only operator")
        a.status = "paused"
        self.agents[agent_id] = a
    @gl.public.write
    def resume_agent(self, agent_id: u256) -> None:
        a = self.agents[agent_id]
        if a.operator != gl.message.sender_address:
            raise gl.vm.UserError("Only operator")
        if a.status != "paused":
            raise gl.vm.UserError("Not paused")
        a.status = "active"
        self.agents[agent_id] = a
    @gl.public.write
    def delist_agent(self, agent_id: u256) -> None:
        a = self.agents[agent_id]
        if a.operator != gl.message.sender_address:
            raise gl.vm.UserError("Only operator")
        # Collateral lock: a bond cannot be withdrawn while any claim on this
        # agent is still pending or under dispute.
        if a.frozen or int(a.open_claims) > 0:
            raise gl.vm.UserError("Open claims block delisting")
        bal = int(a.bond_bal)
        a.status = "delisted"
        a.bond_bal = u256(0)
        self.agents[agent_id] = a
        if bal > 0:
            self._send(a.operator, u256(bal))
    @gl.public.write
    def update_liabilities(self, agent_id: u256, liability_critical: u256,
                            liability_high: u256, liability_medium: u256,
                            liability_low: u256) -> None:
        a = self.agents[agent_id]
        if a.operator != gl.message.sender_address:
            raise gl.vm.UserError("Only operator")
        if a.status == "delisted":
            raise gl.vm.UserError("Agent delisted")
        if a.frozen or int(a.open_claims) > 0:
            # Retiering only ever applies to future claims: a pending/disputed
            # claim is priced by its own bound table, and the live table cannot
            # drift away from those terms mid-flight.
            raise gl.vm.UserError("Liability table frozen by open claims")
        vals = (int(liability_critical), int(liability_high), int(liability_medium), int(liability_low))
        if not (vals[0] >= vals[1] >= vals[2] >= vals[3]):
            raise gl.vm.UserError("Liabilities must descend")
        a.liability_critical, a.liability_high, a.liability_medium, a.liability_low = \
            liability_critical, liability_high, liability_medium, liability_low
        self.agents[agent_id] = a
    @gl.public.write
    def file_claim(self, agent_id: u256, title: str, description: str,
                   evidence: str, impact: str, severity: str) -> u256:
        if agent_id not in self.agents:  # [EXPECTED]
            raise gl.vm.UserError("Agent not found")
        if self.agents[agent_id].status != "active":
            raise gl.vm.UserError("Agent not active")
        sev = _coerce_sev(severity)
        if severity.strip().lower() != sev:
            raise gl.vm.UserError("Invalid severity")
        if len(title.strip()) < 8 or len(description.strip()) < 20 or len(evidence.strip()) < 10:
            raise gl.vm.UserError("Title/description/evidence too short")
        # Payouts trace to authenticated incident evidence: the claimant must
        # embed an artifact link and its content digest. Validators confirm the
        # anchors at audit time; nothing settles on untraceable prose.
        uri, digest = _evidence_anchors(evidence)
        if not uri or not _sha256_ok(digest):
            raise gl.vm.UserError("Evidence must carry uri: and sha256: anchors")
        cid = self.next_claim_id
        claimant = gl.message.sender_address
        a = self.agents[agent_id]
        # A pending claim immediately binds its payout math to the agent's live
        # liability table and freezes the bond (delist, retier: blocked) until
        # the claim reaches a terminal state.
        self.claims[cid] = Claim(cid, agent_id, claimant, title[:200],
            description[:6000], evidence[:6000], impact[:2000], sev, "", "pending",
            u256(0), u256(0), _now(), u256(0), "",
            u256(0),
            a.liability_critical, a.liability_high, a.liability_medium, a.liability_low)
        if int(a.open_claims) == 0:
            a.frozen = True
        a.open_claims = u256(int(a.open_claims) + 1)
        self._append(agent_id, cid, claimant)
        self.agents[agent_id] = a
        self.next_claim_id = cid + u256(1)
        return cid
    @gl.public.write
    def audit_claim(self, claim_id: u256) -> dict:
        """AI audit with comparative consensus. Anyone may call. Only LLM method."""
        if claim_id not in self.claims:  # [EXPECTED]
            raise gl.vm.UserError("Claim not found")
        c0 = gl.storage.copy_to_memory(self.claims[claim_id])
        if c0.status != "pending":
            raise gl.vm.UserError("Already audited")
        a0 = gl.storage.copy_to_memory(self.agents[c0.agent_id])
        if a0.status == "delisted":
            raise gl.vm.UserError("Agent delisted")
        policy_m, title_m, desc_m = a0.policy, c0.title, c0.description
        ev_m, impact_m, claimed_m = c0.evidence, c0.impact, c0.severity_claimed
        # Payouts are bound to authenticated evidence. Anchors were verified at
        # file time; re-derive them from the same stored string here so the
        # consensus prompt can bind them and settlement can fail closed if the
        # claim ever carries evidence without a verifiable artifact link.
        uri_m, digest_m = _evidence_anchors(ev_m)
        if not uri_m or not _sha256_ok(digest_m):
            raise gl.vm.UserError("Claim evidence missing uri: or sha256: anchor")
        existing_m = self._summaries(c0.agent_id, claim_id)
        rw_m = (int(c0.bound_critical), int(c0.bound_high),
                int(c0.bound_medium), int(c0.bound_low))
        def audit_fn() -> dict:
            prompt = ("You are a senior auditor reviewing an incident claim against an AI agent.\n"
                f"AGENT POLICY:\n{policy_m}\nCLAIM:\nTitle: {title_m}\nDesc: {desc_m}\n"
                f"Evidence: {ev_m}\nImpact: {impact_m}\nClaimed: {claimed_m}\n"
                "AUTHENTICITY: evidence is traceable to artifacts via an embedded "
                "uri: link and sha256: digest. If the evidence text is unverifiable "
                "or the anchors read as fabricated, return decision invalid with "
                "reason evidence-not-authenticated.\n"
                f"EXISTING VALID (id|title|sev):\n{existing_m}\n"
                "Judge scope/validity/dupe-id(0 if none)/severity of the agent's misconduct.\n"
                'ONLY JSON: {"decision":"valid|invalid|duplicate",'
                '"severity":"critical|high|medium|low|info",'
                '"duplicate_of":0,"reason":"one line"}')
            out = _norm(gl.nondet.exec_prompt(prompt, response_format="json"))
            out["reward"] = _tier_payout(rw_m, out["severity"])
            out["evidence_uri"], out["evidence_sha256"] = uri_m, digest_m
            return out
        result = gl.eq_principle.prompt_comparative(audit_fn,
            "The `decision` must be identical. If duplicate, `duplicate_of` must "
            "match. `severity` may differ by at most one tier but same risk band, "
            "and `reward` — the GEN the bond pays for that severity per its "
            "liability table — must be identical: verdicts that would pay different "
            "amounts are not equivalent. Every validator must also have "
            "authenticated the same incident evidence (the anchors are echoed in "
            "the verdict).")
        c = self.claims[claim_id]  # deterministic settlement below
        dec, sev = str(result.get("decision", "invalid")), _coerce_sev(result.get("severity", "info"))
        dup, reason, now = _coerce_u(result.get("duplicate_of", 0)), str(result.get("reason", ""))[:280], _now()
        # Evidence authentication is part of the consensus-verdict: the anchors
        # echoed by the consensus round must equal the ones derived from the
        # on-chain evidence string; any mismatch means the round did not audit
        # the stored evidence and must fail closed instead of paying out.
        if str(result.get("evidence_uri", "")) != uri_m or str(result.get("evidence_sha256", "")) != digest_m:
            raise gl.vm.UserError("Evidence anchors not confirmed by consensus")
        if reason.strip().lower() == "evidence-not-authenticated":
            dec, dup, reason = "invalid", u256(0), "Evidence not authenticated"
        if dec == "duplicate":  # verify cited id, don't trust LLM blindly
            ok = (dup != u256(0) and dup in self.claims
                  and self.claims[dup].agent_id == c.agent_id
                  and self.claims[dup].status in ("valid", "paid") and dup != claim_id)
            if not ok:
                dec, dup = "valid", u256(0)
        if dec == "invalid":
            c.status, c.severity_ai = "invalid", sev
        elif dec == "duplicate":
            c.status, c.severity_ai, c.duplicate_of = "duplicate", sev, dup
        else:
            reward = self._liability_for_bound(c, sev)
            if _coerce_u(result.get("reward", 0)) != reward:  # fail closed
                raise gl.vm.UserError("Payout not bound by consensus")
            c.severity_ai, c.payout = sev, reward
            c.status = "valid"
            # Funded to the bound tier, net of anything already delivered:
            # a re-audit after a requeue cannot re-fire the original transfer.
            if reward != u256(0) and self._deliver(c, reward):
                c.status = "paid"
        c.audit_reason, c.resolved_at = reason, now
        self._settle(c)
        self.claims[claim_id] = c
        return {"claim_id": int(claim_id), "decision": c.status,
                "severity": c.severity_ai, "payout": int(c.payout)}
    @gl.public.write
    def claim_payout(self, claim_id: u256) -> None:
        if claim_id not in self.claims:  # [EXPECTED]
            raise gl.vm.UserError("Claim not found")
        c = self.claims[claim_id]
        if c.status != "valid":
            raise gl.vm.UserError("Nothing claimable")
        if c.payout == u256(0):
            raise gl.vm.UserError("Info findings carry no payout")
        net = int(c.payout) - int(c.paid_out)
        if net <= 0:
            raise gl.vm.UserError("Payout already delivered")
        if not self._pay(c.agent_id, c.claimant, u256(net)):
            raise gl.vm.UserError("Bond underfunded")
        c.paid_out = u256(int(c.paid_out) + net)
        c.status = "paid"
        self.claims[claim_id] = c
    @gl.public.write
    def raise_dispute(self, claim_id: u256, reason: str) -> u256:
        if claim_id not in self.claims:  # [EXPECTED]
            raise gl.vm.UserError("Claim not found")
        c = self.claims[claim_id]
        a = self.agents[c.agent_id]
        caller = gl.message.sender_address
        if caller != c.claimant and caller != a.operator:
            raise gl.vm.UserError("Only claimant or agent operator")
        if c.status not in ("valid", "paid", "invalid", "duplicate"):
            # A funded outcome (`paid`) explicitly stays disputable. Only a
            # live dispute blocks a new one, so no stale dispute rides along
            # after a requeue.
            raise gl.vm.UserError("Cannot dispute this status")
        if self._open_dispute_for(claim_id) != u256(0):
            raise gl.vm.UserError("Dispute already open for this claim")
        if not reason.strip():
            raise gl.vm.UserError("Reason required")
        did = self.next_dispute_id
        # Arbitration pays from the claim's own bound table, so the operator
        # cannot change the dispute's worth between raise and resolution.
        self.disputes[did] = Dispute(did, claim_id, caller, reason[:1000], False, "", False,
            c.bound_critical, c.bound_high, c.bound_medium, c.bound_low)
        self.next_dispute_id = did + u256(1)
        c.status = "disputed"
        self.claims[claim_id] = c
        # Disputing re-holds the bond until the dispute settles or requeues.
        a = self.agents[c.agent_id]
        if int(a.open_claims) == 0:
            a.frozen = True
        a.open_claims = u256(int(a.open_claims) + 1)
        self.agents[c.agent_id] = a
        return did
    @gl.public.write
    def resolve_dispute(self, dispute_id: u256, outcome: str, new_severity: str) -> None:
        if gl.message.sender_address != self.owner:  # [EXPECTED] arbitrator
            raise gl.vm.UserError("Only owner arbitrates")
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")
        d = self.disputes[dispute_id]
        if d.resolved:
            raise gl.vm.UserError("Already resolved")
        o = outcome.strip().lower()
        if o not in ("valid", "invalid", "duplicate"):
            raise gl.vm.UserError("Bad outcome")
        c = self.claims[d.claim_id]
        if c.status != "disputed":
            raise gl.vm.UserError("Claim not in dispute (stale dispute)")
        sev = _coerce_sev(new_severity)
        d.resolved, d.outcome, d.settled = True, o, True
        if o == "valid":
            # Arbitration pays the tier of the table bound when the claim was
            # filed (and mirrored at raise), never the live one.
            reward = u256(_tier_payout((int(d.liability_critical), int(d.liability_high),
                int(d.liability_medium), int(d.liability_low)), sev))
            c.severity_ai, c.payout, c.duplicate_of = sev, reward, u256(0)
            c.resolved_at = _now()
            c.status = "valid"
            # Net of anything already delivered while the claim was funded:
            # arbitration cannot repeat the original settlement.
            if reward != u256(0) and self._deliver(c, reward):
                c.status = "paid"
        else:
            c.status = "invalid" if o == "invalid" else "duplicate"
            c.severity_ai, c.resolved_at = sev, _now()
        self._settle(c)
        self.claims[d.claim_id] = c
        self.disputes[dispute_id] = d
    @gl.public.write
    def requeue_disputed(self, claim_id: u256) -> None:
        if claim_id not in self.claims:  # [EXPECTED]
            raise gl.vm.UserError("Claim not found")
        c = self.claims[claim_id]
        if c.status != "disputed":
            raise gl.vm.UserError("Not disputed")
        caller = gl.message.sender_address
        if caller != self.owner and caller != self.agents[c.agent_id].operator:
            raise gl.vm.UserError("Only owner or operator")
        did = self._open_dispute_for(claim_id)
        if did != u256(0):
            d = self.disputes[did]
            # Close as "requeued" so no stale open dispute record rides along
            # with the re-audit. Do NOT mark it settled: the claim keeps its
            # open-claims hold (bond stays frozen) and stays bound to its own
            # terms until the re-audit or a new dispute resolves it terminally.
            d.resolved, d.outcome, d.settled = True, "requeued", False
            self.disputes[did] = d
        c.status, c.audit_reason = "pending", "requeued for re-audit"
        self.claims[claim_id] = c
    @gl.public.view
    def get_agent(self, agent_id: u256) -> dict:
        a = self.agents[agent_id]
        return {"id": int(agent_id), "operator": str(a.operator), "name": a.name,
            "policy": a.policy, "liabilities": {"critical": int(a.liability_critical),
            "high": int(a.liability_high), "medium": int(a.liability_medium),
            "low": int(a.liability_low), "info": 0}, "bond_bal": int(a.bond_bal),
            "status": a.status, "claims": int(self.agent_claim_counts.get(agent_id, u256(0))),
            "open_claims": int(a.open_claims), "frozen": a.frozen}
    @gl.public.view
    def get_claim(self, claim_id: u256) -> dict:
        c = self.claims[claim_id]
        return {"id": int(claim_id), "agent_id": int(c.agent_id), "claimant": str(c.claimant),
            "title": c.title, "description": c.description, "evidence": c.evidence, "impact": c.impact,
            "claimed": c.severity_claimed, "severity_ai": c.severity_ai, "status": c.status,
            "duplicate_of": int(c.duplicate_of), "payout": int(c.payout), "reason": c.audit_reason,
            "paid_out": int(c.paid_out), "bound": {"critical": int(c.bound_critical),
            "high": int(c.bound_high), "medium": int(c.bound_medium), "low": int(c.bound_low)}}
    @gl.public.view
    def get_agent_claims(self, agent_id: u256, offset: u256, limit: u256) -> str:
        # JSON array of claim ids. Plain str keeps the ABI to primitives —
        # unspecialized list generics break contract-schema load.
        n = int(self.agent_claim_counts.get(agent_id, u256(0)))
        out: list = []
        for i in range(int(offset), min(n, int(offset) + max(1, min(50, int(limit))))):
            cid = self.agent_claim_index.get(f"{int(agent_id)}:{i}", u256(0))
            if cid != u256(0):
                out.append(int(cid))
        return json.dumps(out)
    @gl.public.view
    def get_pending_queue(self, limit: u256) -> str:
        # JSON array of pending claim ids (same ABI reason as above).
        out: list = []
        for i in range(1, int(self.next_claim_id)):
            if len(out) >= max(1, min(50, int(limit))):
                break
            cid = u256(i)
            if cid in self.claims and self.claims[cid].status == "pending":
                out.append(i)
        return json.dumps(out)
    @gl.public.view
    def get_agent_stats(self, agent_id: u256) -> dict:
        n = int(self.agent_claim_counts.get(agent_id, u256(0)))
        valid = invalid = dups = pending = paid_total = 0
        for i in range(n):
            cid = self.agent_claim_index.get(f"{int(agent_id)}:{i}", u256(0))
            if cid == u256(0):
                continue
            st = self.claims[cid].status
            if st in ("valid", "paid"):
                valid += 1
            if st == "paid":
                paid_total += int(self.claims[cid].payout)
            elif st == "invalid":
                invalid += 1
            elif st == "duplicate":
                dups += 1
            elif st in ("pending", "disputed"):
                pending += 1
        a = self.agents[agent_id]
        return {"agent_id": int(agent_id), "total": n, "valid": valid,
            "invalid": invalid, "duplicates": dups, "pending": pending,
            "total_paid": paid_total, "bond_bal": int(a.bond_bal)}
    @gl.public.view
    def get_dispute(self, dispute_id: u256) -> dict:
        d = self.disputes[dispute_id]
        return {"id": int(dispute_id), "claim_id": int(d.claim_id),
            "raised_by": str(d.raised_by), "reason": d.reason,
            "resolved": d.resolved, "outcome": d.outcome, "settled": d.settled,
            "bound_liabilities": {"critical": int(d.liability_critical),
            "high": int(d.liability_high), "medium": int(d.liability_medium),
            "low": int(d.liability_low), "info": 0}}
    @gl.public.write
    def set_fee(self, bps: u256) -> None:
        if gl.message.sender_address != self.owner:  # [EXPECTED]
            raise gl.vm.UserError("Only owner")
        if int(bps) > 1000:
            raise gl.vm.UserError("Max 10%")
        self.fee_bps = bps
    @gl.public.write
    def transfer_ownership(self, new_owner: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only owner")
        self.owner = Address(new_owner)
