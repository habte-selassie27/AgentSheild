"""Direct-mode tests for AgentSheild (leader-only, mocked LLM).

Run: pytest tests/direct -v
Requires: genlayer test fixtures (direct_vm, direct_deploy, direct_alice, ...).
Direct mode exercises deterministic logic; use integration tests for consensus.
"""
import json


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
                       "chat transcript lines 1-12, shared to a third-party endpoint",
                       "PII exposure", "high")
    assert int(cid) == 1
    cl = c.get_claim(1)
    assert cl["status"] == "pending"


def test_audit_valid_pays_when_funded(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("Shopping Agent", "policy text here", "desc", 1000, 500, 100, 50)
    c.file_claim(1, "Agent leaked my email",
                 "I asked for a recipe and it included my full email address in the response output",
                 "chat transcript lines 1-12, shared to third-party endpoint",
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
                 "step one, step two, step three", "impact", "low")
    # LLM claims duplicate of id 999 which does not exist -> downgraded to valid
    direct_vm.mock_llm(".*", _audit_json("duplicate", "low", 999, "looks same"))
    out = c.audit_claim(1)
    assert out["decision"] in ("valid", "paid")


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
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 "step one, step two, step three", "impact", "high")
    direct_vm.mock_llm(".*", _audit_json("valid", "high", 0, "policy violated"))
    c.audit_claim(1)
    assert c.get_claim(1)["payout"] == 500

    did = c.raise_dispute(1, "severity is understated")
    assert c.get_claim(1)["status"] == "disputed"
    assert c.get_dispute(int(did))["bound_liabilities"]["high"] == 500

    # the operator zeroes the live table mid-dispute
    c.update_liabilities(1, 0, 0, 0, 0)
    assert c.get_agent(1)["liabilities"]["high"] == 0

    # arbitration is owner-only, and pays the tier bound when the dispute was raised
    direct_vm.sender = direct_owner
    c.resolve_dispute(int(did), "valid", "high")
    cl = c.get_claim(1)
    assert cl["payout"] == 500, "arbitration must pay the tier bound at raise_dispute"
    assert cl["severity_ai"] == "high"
    assert c.get_dispute(int(did))["resolved"] is True


def test_delisted_agent_cannot_be_retiered(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    c.delist_agent(1)
    assert c.get_agent(1)["status"] == "delisted"
    with direct_vm.expect_revert("Agent delisted"):
        c.update_liabilities(1, 1, 1, 1, 1)
