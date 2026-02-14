# NuCmdk Search Resolution Metrics Spec

**Status:** Locked candidate (performance governance)  
**Date:** 2026-02-13

---

## Objective

Primary optimization target is **Time To Resolution (TTR)**.

For NuCmdk, "resolved" means:

1. user executed intended row successfully, **or**
2. top-ranked actionable row stabilized and was selected/executed within confidence window.

---

## Canonical timing events

All timestamps are monotonic milliseconds (`t_ms`) from one run clock source.

- `query.input.started`
- `query.input.changed`
- `rows.first_visible`
- `rows.first_actionable`
- `rows.top1_stable`
- `selection.changed`
- `execution.started`
- `execution.succeeded`
- `execution.failed`
- `query.cancelled`

---

## Core metrics (required)

## M1 — TTR (primary)

`TTR_ms = execution.succeeded - query.input.started`

If unresolved/cancelled, record null + terminal reason.

## M2 — TTFA (time-to-first-actionable)

`TTFA_ms = rows.first_actionable - query.input.started`

## M3 — TTS (time-to-stability)

`TTS_ms = rows.top1_stable - query.input.started`

## M4 — Cancel latency

`cancel_latency_ms = query.cancelled -> all lane status=closed`

## M5 — Resolution success rate

`resolution_success = succeeded_runs / total_runs`

---

## Quality/regression guard metrics (required)

- `fallback_ratio = fallback_rows / rendered_rows`
- `decode_drop_ratio = dropped_rows / incoming_rows`
- `resolver_deny_ratio = denied_dispatches / attempted_dispatches`
- `ranking_oscillation_count` (top1 changed after stability window)
- `lane_starvation_count` (lane had updates but zero publish windows)

These do not replace TTR; they constrain optimization from lying.

---

## Aggregate score for optimization

We optimize this scalar objective:

```text
ObjectiveScore =
  P95(TTR_ms)
  + 0.35 * P95(TTFA_ms)
  + 0.20 * P95(TTS_ms)
  + penalty_quality
  + penalty_stability
  + penalty_safety
```

Penalties:

- `penalty_quality` if fallback/decode drops exceed budget.
- `penalty_stability` if oscillation exceeds threshold.
- `penalty_safety` if any resolver policy violation (hard fail, large constant).

---

## SLO targets (initial)

Local/dev dataset:

- `P50 TTR <= 450ms`
- `P95 TTR <= 1200ms`
- `P95 TTFA <= 300ms`
- `P95 cancel_latency <= 120ms`
- `resolution_success >= 0.97`
- `resolver policy violations == 0`

Targets are tuned by run history, but safety-zero remains non-negotiable.

---

## Required log dimensions

Every run must include:

- `run_id`, `scenario_id`, `dataset_id`
- parameter vector hash (`theta_hash`)
- lane profile and concurrency profile
- metric summary (`p50/p95`)
- penalty breakdown
- pass/fail + reason

---

## Notes

- TTR is primary, but cannot be optimized independently from safety/quality.
- Any run with policy violation is invalid for hillclimb acceptance.
