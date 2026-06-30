# CrowdFactCheck

**Crowd-sourced evidence, synthesized into a consensus fact rating, on GenLayer.**

[![GenLayer](https://img.shields.io/badge/GenLayer-Bradbury-ff4d6d)](https://genlayer.com) [![chainId](https://img.shields.io/badge/chainId-4221-4dd0e1)](https://docs.genlayer.com) [![contract](https://img.shields.io/badge/contract-Python%20GenVM-8a63d2)](https://docs.genlayer.com) [![tests](https://img.shields.io/badge/tests-5%2F5%20passing-3fb950)](tests) [![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20genlayer--js-22a6f2)](app) [![live](https://img.shields.io/badge/live-crowdfactcheck.pages.dev-f59e0b)](https://crowdfactcheck.pages.dev) [![License](https://img.shields.io/badge/license-MIT-2dd4bf)](LICENSE)

Anyone submits a circulating claim. The crowd attaches evidence links (supporting or debunking).
`assess` has every validator independently fetch the gathered evidence and synthesize a rating —
**true / misleading / false / unverified** — accepted only when validators agree on the **rating**
(comparative equivalence). The value is a transparent, evidence-cited verdict produced from many
sources, not one outlet's say-so.

The verb is **"crowd gathers evidence → consensus synthesizes a rating"** — distinct from a single
asserter's bonded claim; the evidence set is collective.

- **Live demo:** https://crowdfactcheck.pages.dev
- **Contract (Bradbury, chain 4221):** `0x8F1576FA69Fa1A1cc9863695B41f03078c9bC775`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x8F1576FA69Fa1A1cc9863695B41f03078c9bC775

---

## Why GenLayer is essential

Synthesizing a fact rating from many web sources requires fetching + reading + judging — a deterministic
EVM can do none of that. GenLayer has validators read the same crowd-gathered evidence and agree on the
rating, producing an auditable, decentralized fact-check rather than a centralized arbiter's verdict.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Submit | `submit_claim(claim)` | Posts a claim to check. |
| Evidence | `add_evidence(id, url)` | The crowd attaches supporting/debunking sources. |
| Assess | `assess(id)` | Consensus synthesizes a rating from the evidence (re-assessable). |
| Read | `get_claim(id)` / `stats()` | Claim, evidence list, rating, summary. |

### Correctness check

`_assess` wraps the rating in **`gl.eq_principle.prompt_comparative`** — principle: *"the rating
(true / misleading / false / unverified) must be identical across validators."* `validate_rating`
enforces the rating enum + non-empty summary; `normalize_rating` defaults the unclear case to
**unverified**. Assessing requires at least one piece of evidence. Unit-tested incl. submit→add→assess
and a `false` rating run.

## Architecture

```
CrowdFactCheck/
├── contracts/crowd_fact_check.py  ← GenLayer Intelligent Contract (crowd evidence + consensus rating)
├── tests/                         ← pytest: rating guards, evidence-required, full flow, false rating
└── app/                           ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                     teal verify theme, claim board + crowd evidence links + rating verdict
```

## Tests

```bash
cd CrowdFactCheck
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_rating` / `validate_rating`, an evidence-required guard, a full **submit → add_evidence
→ assess** run, and a `false` rating (shim auto-inits `TreeMap`). **On-chain smoke-tested:** `submit_claim`
write + `get_claim` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/crowd_fact_check.py
```
