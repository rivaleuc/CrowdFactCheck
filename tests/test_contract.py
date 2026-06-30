"""CrowdFactCheck tests: rating guards + submit→add_evidence→assess flow incl. a 'false' rating."""


def test_normalize_rating(contract):
    n = contract.normalize_rating
    assert n({"rating": "false", "summary": "debunked"})["rating"] == "false"
    assert n({"rating": "MISLEADING", "summary": "x"})["rating"] == "misleading"
    assert n({})["rating"] == "unverified"        # conservative default
    assert n("garbage")["summary"] == "no summary"

def test_validate_rating(contract):
    v = contract.validate_rating
    assert v({"rating": "true", "summary": "confirmed by 3 sources"})
    assert not v({"rating": "fake", "summary": "x"})
    assert not v({"rating": "true", "summary": "  "})


def _new(contract):
    return contract, contract.CrowdFactCheck()

def test_assess_requires_evidence(contract):
    mod, c = _new(contract)
    cid = c.submit_claim("The bridge was hacked for $200M")
    try:
        c.assess(cid); assert False, "should require evidence first"
    except Exception:
        pass

def test_full_flow(contract):
    mod, c = _new(contract)
    cid = c.submit_claim("Token X is a registered security")
    e = c.add_evidence(cid, "https://sec.example/filing")
    assert e["evidence_count"] == 1
    c.add_evidence(cid, "https://news.example/article")
    out = c.assess(cid)
    assert out["rating"] == "unverified"      # offline default
    cl = c.get_claim(cid)
    assert cl["state"] == "assessed" and len(cl["evidence"]) == 2
    st = c.stats()
    assert st["total_claims"] == 1 and st["assessed"] == 1 and st["evidence"] == 2

def test_false_rating(contract):
    mod, c = _new(contract)
    cid = c.submit_claim("Vaccines contain microchips")
    c.add_evidence(cid, "https://factcheck.example/debunk")
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"rating": "false", "summary": "No evidence; debunked repeatedly."})
    c.assess(cid)
    assert c.get_claim(cid)["rating"] == "false"
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
