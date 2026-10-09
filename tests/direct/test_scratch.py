import json


def test_scratch(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy("contracts/AgentSheild.py")
    direct_vm.sender = direct_alice
    c.register_agent("A", "policy", "desc", 1000, 500, 100, 50)
    direct_vm.value = 2 * 10 ** 18
    c.bond_agent(1)
    direct_vm.value = 0
    print("bond:", c.get_agent(1)["bond_bal"])
    print("self balance:", direct_vm._balances)
    c.file_claim(1, "Title number one here",
                 "A sufficiently long description of the incident",
                 "step one, step two, step three\n"
                 "uri:https://artifacts.example/incident-01.json"
                 " sha256:" + "a" * 64, "impact", "high")
    direct_vm.mock_llm(".*", json.dumps({"decision": "valid", "severity": "high",
                                         "duplicate_of": 0, "reason": "violated"}))
    out = c.audit_claim(1)
    print("audit out:", out)
    print("claim:", c.get_claim(1))
    print("balances:", {k.hex(): v for k, v in direct_vm._balances.items()})
