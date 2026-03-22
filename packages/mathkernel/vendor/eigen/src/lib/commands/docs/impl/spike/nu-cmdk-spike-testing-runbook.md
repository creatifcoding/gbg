# NuCmdk Spike Testing Runbook

**Status:** Active  
**Date:** 2026-02-13

---

## Intent

Run short, repeatable spike sessions focused on **time-to-resolution** and use hillclimbing to tune query-session behavior safely.

Primary objective: reduce P95 TTR without violating resolver safety, isolation, or selection identity invariants.

---

## Inputs

- Metrics spec: `../../arch/nu-cmdk-search-resolution-metrics-spec.md`
- Hillclimb spec: `../../arch/nu-cmdk-hillclimb-optimization-spec.md`
- Red-team scenarios: `../../arch/nu-cmdk-redteam-simulation-matrix.md`

---

## Run phases

1. **Bootstrap**
   - register run id
   - lock `theta` candidate
   - choose scenario batch
2. **Spike execution**
   - execute scenario batch
   - collect per-query event traces
3. **Scoring**
   - compute objective + penalties
   - evaluate guardrails
4. **Decision**
   - accept/reject candidate
   - append decision to logs

---

## Log files

Directory:

- `./logs/`

Per run:

- `<date>-<run-id>.jsonl` (event + summary records)

Index:

- `./logs/README.md`

---

## JSONL record types

## `run.start`

```json
{
  "type": "run.start",
  "run_id": "spike-0001",
  "theta_hash": "...",
  "theta": {"publish_budget_base": 4},
  "scenario_batch": ["RTM-005", "RTM-010"],
  "ts_ms": 0
}
```

## `query.metric`

```json
{
  "type": "query.metric",
  "run_id": "spike-0001",
  "query_id": "q-12",
  "scenario_id": "RTM-010",
  "ttr_ms": 622,
  "ttfa_ms": 180,
  "tts_ms": 240,
  "cancel_latency_ms": 34,
  "fallback_ratio": 0.07,
  "decode_drop_ratio": 0.01,
  "resolver_deny_ratio": 0,
  "policy_violations": 0,
  "selection_identity_violations": 0,
  "ts_ms": 622
}
```

## `run.summary`

```json
{
  "type": "run.summary",
  "run_id": "spike-0001",
  "objective_score": 931.4,
  "p95": {"ttr_ms": 1180, "ttfa_ms": 290, "tts_ms": 340},
  "penalties": {"quality": 0, "stability": 0, "safety": 0},
  "accepted": true,
  "reject_reason": null,
  "ts_ms": 9999
}
```

---

## Scripted execution

```bash
# default run-id=spike-0002, default out-dir=docs spike logs
bun run spike:nu-cmdk:impl-spec

# custom run-id
bun run spike:nu-cmdk:impl-spec --run-id=spike-0003

# custom output directory
bun run spike:nu-cmdk:impl-spec --run-id=spike-0004 --out-dir=src/lib/commands/docs/impl/spike/logs
```

## Immediate execution checklist

- [ ] run script for next candidate batch
- [ ] review generated `*.jsonl` and `*-comparison.md`
- [ ] validate guardrails (policy/lane/selection violations)
- [ ] accept/reject hillclimb winner
- [ ] update `./logs/README.md` index

---

## Current status

Spike logging has been bootstrapped with baseline run registration in `./logs/2026-02-13-spike-0001-baseline.jsonl`.
