# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
CrowdFactCheck — crowd-sourced evidence, synthesized into a consensus fact rating.

Anyone submits a circulating claim. The crowd then attaches evidence links
(supporting or debunking). `assess` has every validator independently fetch the
gathered evidence and synthesize a rating — true / misleading / false / unverified
— accepted only when validators agree on the RATING (comparative equivalence).
The value is a transparent, evidence-cited verdict produced from many sources, not
one outlet's say-so.

The verb is "crowd gathers evidence → consensus synthesizes a rating" — distinct
from a single asserter's bonded claim; the evidence set is collective.
"""
import json
from genlayer import *

RATINGS = ("true", "misleading", "false", "unverified")
MAX_EVIDENCE = 10


def normalize_rating(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    rating = str(raw.get("rating", "")).strip().lower()
    if rating not in RATINGS:
        rating = "unverified"          # conservative default
    summary = raw.get("summary")
    summary = summary[:600] if isinstance(summary, str) and summary.strip() else "no summary"
    return {"rating": rating, "summary": summary}


def validate_rating(data) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("rating") not in RATINGS:
        return False
    s = data.get("summary")
    return isinstance(s, str) and bool(s.strip())


class CrowdFactCheck(gl.Contract):
    claims: TreeMap[str, str]
    claim_count: u256
    assessed_count: u256
    evidence_count: u256

    def __init__(self):
        self.claim_count = u256(0)
        self.assessed_count = u256(0)
        self.evidence_count = u256(0)

    @gl.public.write
    def submit_claim(self, claim: str) -> str:
        claim = str(claim).strip()
        if not claim:
            raise Exception("claim required")
        key = str(int(self.claim_count))
        rec = {
            "submitter": str(gl.message.sender_address),
            "claim": claim[:500],
            "evidence": [],            # [{by, url}]
            "state": "open",           # open -> assessed (re-assessable as evidence grows)
            "rating": "",
            "summary": "",
        }
        self.claims[key] = json.dumps(rec)
        self.claim_count += u256(1)
        return key

    @gl.public.write
    def add_evidence(self, claim_id: str, url: str) -> dict:
        claim_id = str(claim_id)
        if claim_id not in self.claims:
            raise Exception("unknown claim")
        c = json.loads(self.claims[claim_id])
        url = str(url).strip()
        if not url.startswith("http"):
            raise Exception("http evidence url required")
        if len(c["evidence"]) >= MAX_EVIDENCE:
            raise Exception("evidence limit reached")
        c["evidence"].append({"by": str(gl.message.sender_address), "url": url[:400]})
        self.claims[claim_id] = json.dumps(c)
        self.evidence_count += u256(1)
        return {"claim": claim_id, "evidence_count": len(c["evidence"])}

    @gl.public.write
    def assess(self, claim_id: str) -> dict:
        """Synthesize a consensus rating from the gathered evidence."""
        claim_id = str(claim_id)
        if claim_id not in self.claims:
            raise Exception("unknown claim")
        c = json.loads(self.claims[claim_id])
        if not c["evidence"]:
            raise Exception("add evidence before assessing")
        res = self._assess(c["claim"], [e["url"] for e in c["evidence"]])
        was_assessed = c["state"] == "assessed"
        c["rating"] = res["rating"]
        c["summary"] = res["summary"]
        c["state"] = "assessed"
        self.claims[claim_id] = json.dumps(c)
        if not was_assessed:
            self.assessed_count += u256(1)
        return {"claim": claim_id, "rating": res["rating"]}

    def _assess(self, claim: str, urls) -> dict:
        use = [u for u in urls if u.startswith("http")][:5]

        def fetch_and_rate() -> str:
            evidence = ""
            for u in use:
                try:
                    evidence += f"\n--- {u} ---\n" + gl.nondet.web.get(u).body.decode("utf-8")[:2000]
                except Exception:
                    try:
                        evidence += f"\n--- {u} ---\n" + gl.nondet.web.render(u, mode="text")[:2000]
                    except Exception:
                        evidence += f"\n--- {u} (fetch failed) ---\n"
            if not evidence:
                evidence = "(no fetchable evidence)"
            prompt = f"""You are a fact-checker. Rate the CLAIM using ONLY the gathered EVIDENCE.

CLAIM: {claim}

EVIDENCE (fetched now):
{evidence[:7000]}

Rating: "true", "misleading" (partly true but deceptive), "false", or "unverified" (evidence insufficient).
Reply ONLY JSON: {{"rating":"true|misleading|false|unverified","summary":"<2-3 sentences citing the evidence>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_rating(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_rate,
            principle="The 'rating' (true / misleading / false / unverified) must be identical across validators. Summary wording may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_rating(data):
            data = normalize_rating(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def get_claim(self, claim_id: str) -> dict:
        claim_id = str(claim_id)
        if claim_id not in self.claims:
            return {"exists": False}
        c = json.loads(self.claims[claim_id])
        c["exists"] = True
        return c

    @gl.public.view
    def stats(self) -> dict:
        return {"total_claims": int(self.claim_count), "assessed": int(self.assessed_count), "evidence": int(self.evidence_count)}
