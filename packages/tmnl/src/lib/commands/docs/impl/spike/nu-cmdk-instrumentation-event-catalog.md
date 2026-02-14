# NuCmdk Instrumentation Event Catalog (TTR)

**Status:** Spike-ready  
**Date:** 2026-02-13

---

## Purpose

Define concrete event keys and payload fields for QuerySession instrumentation so spike runs can compute TTR, TTFA, TTS, and quality/safety penalties deterministically.

---

## Event keys (required)

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

### Lane / guardrail events

- `lane.chunk.received`
- `lane.chunk.dropped.stale_seq`
- `lane.state.changed`
- `resolver.dispatch.allowed`
- `resolver.dispatch.denied`
- `renderer.resolve.exact`
- `renderer.resolve.compatible`
- `renderer.resolve.fallback`
- `renderer.resolve.drop`
- `cache.hit`
- `cache.miss`
- `cache.integrity.invalidate`

---

## Event envelope

```json
{
  "event": "query.input.started",
  "run_id": "spike-0002-c1",
  "scenario_id": "RTM-010",
  "query_id": "q-001",
  "lane_id": "rpc",
  "t_ms": 1739492000123,
  "attrs": {
    "query_text_len": 9,
    "theta_hash": "theta-i1-a"
  }
}
```

Required base fields:

- `event`
- `run_id`
- `query_id`
- `t_ms`
- `attrs` object

Optional context:

- `scenario_id`
- `lane_id`
- `row_id`
- `resolver_identity`
- `renderer_token`

---

## Derived metric formulas

- `TTR_ms = execution.succeeded.t_ms - query.input.started.t_ms`
- `TTFA_ms = rows.first_actionable.t_ms - query.input.started.t_ms`
- `TTS_ms = rows.top1_stable.t_ms - query.input.started.t_ms`
- `cancel_latency_ms = lane.closed_all.t_ms - query.cancelled.t_ms`

Quality counters are aggregated from event frequencies per query and per run.

---

## Span naming (Effect.withSpan)

Recommended span names:

- `NuCmdk.QuerySession.loop`
- `NuCmdk.QuerySession.reduceMessage`
- `NuCmdk.QuerySession.authorizeResolver`
- `NuCmdk.QuerySession.resolveRenderer`
- `NuCmdk.CacheGuard.reconcileRows`
- `NuCmdk.Ranking.recompute`

---

## Logging guidance

1. Emit event once per state transition edge, not per render frame.
2. Keep attributes bounded and typed.
3. Never log raw secrets or credentials.
4. Keep resolver denial reason normalized (enum-like strings).

---

## Output contract for spikes

Raw event stream may be verbose; spike logs should include:

- compact `query.metric` records
- one `run.summary` record
- optional pointer to raw trace artifact

This aligns with `nu-cmdk-spike-testing-runbook.md`.
