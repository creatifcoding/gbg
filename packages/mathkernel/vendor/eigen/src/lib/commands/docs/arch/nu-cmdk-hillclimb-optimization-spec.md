# NuCmdk Hillclimb Optimization Spec

**Status:** Locked candidate (tuning control loop)  
**Date:** 2026-02-13

---

## Goal

Use constrained hillclimbing to minimize `ObjectiveScore` from `nu-cmdk-search-resolution-metrics-spec.md`, with hard safety/quality guardrails.

---

## Parameter vector (`theta`)

Initial tunable parameters:

- `publish_budget_base`
- `publish_budget_degraded`
- `rank_weight.provider`
- `rank_weight.lexical`
- `rank_weight.semantic`
- `rank_weight.recency`
- `stability_epsilon`
- `stability_window_ms`
- `quality_budget.max_fallback_ratio`
- `quality_budget.max_decode_drop_ratio`
- `quality_budget.max_resolver_deny_ratio`
- `cacheguard.singleflight_ttl_ms`
- `cacheguard.checkpoint_wal_pages`

All parameters are bounded (`min/max`) and versioned.

---

## Acceptance constraints (must hold)

A candidate `theta'` is eligible only if:

1. `resolver policy violations == 0`
2. `lane isolation violations == 0`
3. `selection identity violations == 0`
4. `P95 cancel_latency <= max_cancel_latency_budget`

If any fail: reject candidate regardless of TTR improvement.

---

## Hillclimb loop

```text
seed theta_0
for iteration i in 1..N:
  generate neighbor set N(theta_i)
  run spike scenarios for each neighbor
  compute ObjectiveScore + guardrail checks
  pick best admissible neighbor
  if score improved by >= epsilon: accept
  else: reduce step size and continue
  stop on convergence or max iterations
```

---

## Neighbor generation

Use coordinate + paired moves:

1. **Coordinate step**: perturb one parameter at a time (`±step`).
2. **Paired step**: perturb coupled params together (e.g., lexical/semantic weights).
3. **Adaptive step shrink**: halve step size after no-improvement epoch.

---

## Exploration/exploitation schedule

- Iterations 1-3: broader moves (exploration)
- Iterations 4-8: mixed moves
- Iterations 9+: local refinement (small-step exploitation)

---

## Run budgeting

Per iteration:

- smoke scenarios: always
- heavy adversarial scenarios: every 2nd iteration
- full suite: on acceptance candidates only

This keeps wall-clock tuning practical while preserving safety checks.

---

## Log contract per candidate

Required fields:

- `run_id`
- `iteration`
- `theta`
- `theta_hash`
- `scenario_batch`
- `objective_score`
- `metrics` (`p50/p95`)
- `penalties`
- `accepted` boolean
- `reject_reason`

---

## Stop conditions

Stop when any true:

1. no improvement `>= epsilon` for `patience` iterations
2. step size < `min_step`
3. run budget exhausted
4. SLO met for K consecutive accepted iterations

---

## Output artifact

At end of session emit:

- `best_theta.json`
- `optimization-summary.md`
- append entry in `impl/spike/logs/README.md`

These become trace evidence for cutover gate.
