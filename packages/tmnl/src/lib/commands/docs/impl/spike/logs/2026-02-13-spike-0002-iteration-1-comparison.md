# Spike 0002 — Iteration 1 Candidate Comparison

**Mode:** pilot-simulated (pre-runtime instrumentation wiring)  
**Run file:** `2026-02-13-spike-0002-iteration-1.jsonl`

---

## Candidates

| Candidate | Run ID | ObjectiveScore | P95 TTR | P95 TTFA | P95 TTS | Quality Penalty | Stability Penalty | Safety Penalty | Guardrails |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| baseline | spike-0002-c0 | 1626.5 | 1328 | 318 | 386 | 85 | 25 | 0 | PASS |
| neighbor-a | spike-0002-c1 | 1325.7 | 1136 | 271 | 324 | 20 | 10 | 0 | PASS |

---

## Decision

Accepted `spike-0002-c1` (`theta-i1-a`) for iteration 1.

### Why

- Objective improved by **300.8**.
- P95 TTR improved (1328 -> 1136).
- Penalties reduced materially.
- No guardrail violations.

---

## Next iteration target

Explore neighborhood around `theta-i1-a`:

1. `publish_budget_base`: `5 -> 6` and `5 -> 4`
2. semantic vs lexical weighting micro-adjust (`±0.03`)
3. stability window (`140ms -> 120ms` and `160ms`)
4. checkpoint wal pages (`900 -> 800`, `900 -> 1000`)

Run heavy adversarial set in iteration 2: `RTM-006`, `RTM-010`, `RTM-012`, `RTM-016`, `RTM-017`.
