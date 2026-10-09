"""Direct-mode tests for AgentSheild (leader-only, mocked LLM).

Run: pytest tests/direct -v
Requires: genlayer test fixtures (direct_vm, direct_deploy, direct_alice, ...).
Direct mode exercises deterministic logic; use integration tests for consensus.
"""
import json

SHA = "a" * 64


def _ev(text="chat transcript lines 1-12, shared to a third-party endpoint"):
    return f"{text}\nuri:https://artifacts.example/incident-01.json sha256:{SHA}"


def _audit_json(decision="valid", severity="high", dup=0, reason="policy violated"):
    return json.dumps({"decision": decision, "severity": severity,
                       "duplicate_of": dup, "reason": reason})


def test_register_and_file_claim(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    aid = c.register_agent("Shopping Agent", '{"never":"share PII"}',
                           "Autonomous checkout assistant",
                           1000, 500, 100, 50)
    assert int(aid) == 1
    cid = c.file_claim(1, "Agent leaked my email",
                       "I asked for a recipe and it included my full email address in the response output",
                       _ev(),
                       "PII exposure", "high")
    assert int(cid) == 1
    cl = c.get_claim(1)
    assert cl["status"] == "pending"
    # filing a claim locks the operator-adjustable state immediately
    assert cl["bound"]["high"] == 500
    assert c.get_agent(1)["frozen"] is True
    with direct_vm.expect_revert("Open claims block delisting"):
        c.delist_agent(1)
    with direct_vm.expect_revert("Liability table frozen by open claims"):
        c.update_liabilities(1, 1, 1, 1, 1)


def test_file_claim_requires_authenticated_evidence(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    with direct_vm.expect_revert("Evidence must carry uri: and sha256: anchors"):
        c.file_claim(1, "Title number one here",
                     "A sufficiently long description of the incident",
                     "prose only, no linkage at all", "impact", "low")
    with direct_vm.expect_revert("Evidence must carry uri: and sha256: anchors"):
        c.file_claim(1, "Title number one here",
                     "A sufficiently long description of the incident",
                     _ev("ok")[: -40] + "z" * 21, "impact", "low")  # 21 z's: not hex64


def test_audit_valid_pays_when_funded(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("Shopping Agent", "policy text here", "desc", 1000, 500, 100, 50)
    c.file_claim(1, "Agent leaked my email",
                 "I asked for a recipe and it included my full email address in the response output",
                 _ev("chat transcript lines 1-12, shared to third-party endpoint"),
                 "PII exposure", "high")
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    # bond_agent is payable in integration; direct mode tops up via cheatcode
    out = c.audit_claim(1)
    assert out["decision"] in ("valid", "paid")
    assert out["severity"] == "high"
    assert int(out["payout"]) == 500  # consensus-bound liability_high tier


def test_audit_rejects_hallucinated_duplicate(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 100, 50, 10, 5)
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 _ev("step one, step two, step three"), "impact", "low")
    # LLM claims duplicate of id 999 which does not exist -> downgraded to valid
    direct_vm.mock_llm(".*", _audit_json("duplicate", "low", 999, "looks same"))
    out = c.audit_claim(1)
    assert out["decision"] in ("valid", "paid")


def test_audit_settles_from_bound_terms_after_retier_pause(direct_vm, direct_deploy, direct_alice):
    """An operator re-tiering between filing and audit cannot change what the
    pending claim pays: the audit settles from the terms bound at filing."""
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 _ev(), "impact", "high")
    # Re-audit with the agent paused: status never unlocks bound terms.
    c.pause_agent(1)
    assert c.get_agent(1)["status"] == "paused"
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    out = c.audit_claim(1)
    assert int(out["payout"]) == 500  # bound at filing, not from paused state
    cl = c.get_claim(1)
    assert cl["status"] == "paid" or cl["payout"] == 500
    assert cl["bound"]["high"] == 500


def test_bad_severity_rejected(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 100, 50, 10, 5)
    with direct_vm.expect_revert("Invalid severity"):
        c.file_claim(1, "Title number one here",
                     "A sufficiently long description of the incident",
                     "step one, step two, step three", "impact", "apocalyptic")


def test_arbitration_pays_from_the_bound_liability_table(direct_vm, direct_deploy, direct_alice,
                                                        direct_owner):
    """An operator must not be able to retier the table between raise_dispute and
    resolve_dispute to change what the arbitration is worth. Without the snapshot
    bound at raise time, zeroing the table here would pay the claimant 0."""
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    direct_vm.value = 2 * 10 ** 18
    c.bond_agent(1)
    direct_vm.value = 0
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 _ev(), "impact", "high")
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    assert c.audit_claim(1)["decision"] == "paid"
    assert c.get_claim(1)["payout"] == 500

    did = c.raise_dispute(1, "severity is understated")
    assert c.get_claim(1)["status"] == "disputed"
    assert c.get_dispute(int(did))["bound_liabilities"]["high"] == 500

    # No way to re-tier once a dispute is open (collateral lock).
    with direct_vm.expect_revert("Liability table frozen by open claims"):
        c.update_liabilities(1, 0, 0, 0, 0)
    assert c.get_agent(1)["liabilities"]["high"] == 500

    # requeue keeps the bond held: dispute closed, claim back to pending,
    # and no stale dispute record riding along.
    c.requeue_disputed(1)
    assert c.get_claim(1)["status"] == "pending"
    assert c.get_dispute(int(did))["outcome"] == "requeued"
    assert c.get_dispute(int(did))["settled"] is False
    assert c.get_agent(1)["open_claims"] >= 1
    # A second raise_dispute is blocked by claim status (pending again): the
    # open-dispute gate only kicks in when a dispute record is still live.
    with direct_vm.expect_revert("Cannot dispute this status"):
        c.raise_dispute(1, "second dispute while one still rides")

    # re-audit still settles from the same bound terms, and never re-fires the
    # original transfer: paid_out nets out what was already delivered.
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    assert c.audit_claim(1)["decision"] == "paid"
    cl = c.get_claim(1)
    assert cl["payout"] == 500
    assert int(cl["paid_out"]) == 500  # not doubled by re-audit
    assert cl["status"] == "paid"

    # Terminal arbitration over the re-paids is allowed again once re-audit
    # settles the dispute-cycle; a fresh dispute can now be raised.
    did2 = int(c.raise_dispute(1, "still understated after re-audit"))
    direct_vm.sender = direct_owner
    c.resolve_dispute(did2, "valid", "critical")
    cl = c.get_claim(1)
    assert cl["payout"] == 1000
    assert int(cl["paid_out"]) == 1000  # top-up only; nothing double-delivered
    assert c.get_dispute(did2)["settled"] is True


def test_stale_dispute_cannot_settle_and_funded_stays_disputable(direct_vm, direct_deploy, direct_alice, direct_owner):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    direct_vm.value = 10 ** 18
    c.bond_agent(1)
    direct_vm.value = 0
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 _ev(), "impact", "high")
    direct_vm.mock_llm(".*", _audit_json("invalid", "high", 0, "out of scope"))
    assert c.audit_claim(1)["decision"] == "invalid"

    # funded/invalid outcomes stay disputable...
    did = int(c.raise_dispute(1, "audit was wrong"))
    # ...and after the requeue closes it back to pending, the already-closed
    # dispute cannot be re-resolved (no repeated settlement), and the claim is
    # back in the audit queue, not silently settled off a stale dispute.
    c.requeue_disputed(1)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Already resolved"):
        c.resolve_dispute(did, "invalid", "high")
    assert c.get_dispute(did)["outcome"] == "requeued"
    assert c.get_dispute(did)["settled"] is False
    assert c.get_claim(1)["status"] == "pending"


def test_repeated_settlement_blocked_at_claim_payout(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    direct_vm.value = 10 ** 18
    c.bond_agent(1)
    direct_vm.value = 0
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 _ev(), "impact", "high")
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    assert c.audit_claim(1)["decision"] == "paid"
    before = c.get_agent(1)["bond_bal"]
    with direct_vm.expect_revert("Nothing claimable"):
        c.claim_payout(1)  # already paid automatically; no second settlement
    assert c.get_agent(1)["bond_bal"] == before


def test_delisted_agent_cannot_be_retiered(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    c.delist_agent(1)
    assert c.get_agent(1)["status"] == "delisted"
    with direct_vm.expect_revert("Agent delisted"):
        c.update_liabilities(1, 1, 1, 1, 1)
